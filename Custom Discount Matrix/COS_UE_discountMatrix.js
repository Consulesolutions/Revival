/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/**
 * Script Name          :   COS UE Discount Matrix
 * File Name            :   COS_UE_discountMatrix.js
 * 
 * Description          :   
 * 
 * Dependencies         :   format--- <this File Name> <is used by/uses> <this Dependency>
 * Libraries            :   
 * 
* Version              :   1.0.0 initial version
 *                          1.0.1
 *                          1.0.2 - do not run conditionally based on pricing baseprice vendor price is empty
 *                          1.0.3 - ignore multiplier for non assembly/kit
 *                          
 * 
 * Date                 :   07 17, 2023
 * Project              :   Revival Parts
 * Author               :   Rodmar Dimasaca
 * Email                : rod@consulesolutions.com
 * Notes                :   
 * 
 * TODOs                :   
 * 
 */
define(['N/record', 'N/search', 'N/runtime', 'N/https', 'N/file', 'N/task'],
/**
 * @param {record} record
 * @param {search} search
 * @param {runtime} runtime
 */
function(record, search, runtime, https, file, task) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
	 * @governance 0
     */
    function beforeLoad(scriptContext)
    {
    	try
    	{
            if(scriptContext.type == "view" || scriptContext.type == "edit")
            {
				scriptContext.form.addTab({
                    label : "Consumption Demand Report",
                    id : "custpage_tab_rd_cdr"
                })

                var fieldObj = scriptContext.form.addField({
                    label : "Consumption Demand Report",
                    type : "inlinehtml",
                    id : "custpage_tab_rd_cdr",
                    container : "custpage_tab_rd_cdr"
                });

                var suiteletUrl = url.resolveScript({
                    scriptId : "customscript_cos_consumptiondemandreport",
                    deploymentId : "customdeploy_cos_consumptiondemandreport"
                })

                fieldObj.defaultValue = `<iframe width='100%' height='1000px' src='${suiteletUrl}&lockitem=` + scriptContext.newRecord.id + `'></iframe>`
            }
    	}
    	catch(e)
    	{
    		log.error("ERROR in function beforeLoad", {stack : e.stack, message : e.message});
    	}
    }

    //test data
    //item id 33412 0% M1
    //item id 1812 30% M2

    function afterSubmit(scriptContext)
    {

        var executionContext = runtime.executionContext;
        log.debug("afterSubmit executionContext", executionContext);
        if(executionContext == "MAPREDUCE")
        {
            return;
        }




        var OFFLOAD_TRESHOLD = 150;
        var ITEM_COUNT_LIMIT = 10;
        var PROCESS_ALL_ITEMS = true;
    	try
    	{
            if(scriptContext.type == "xedit" || scriptContext.type == "edit" || scriptContext.type == "create")
            {
                var currRec = scriptContext.newRecord;


                var submitStatus = currRec.getValue({
                    fieldId : "custpage_cos_dm_status"
                });

                log.debug("submitStatus", submitStatus);




                var currRec_marginrate = currRec.getValue({
                    fieldId : "custrecord_cos_discountmatrix_marginrate"
                });
                var currRec_pricelevel = currRec.getValue({
                    fieldId : "custrecord_cos_discountmatrix_d"
                });
                if(!currRec_pricelevel)
                {
                    log.debug("aborting... unresolved discount matrix pricelevel")
                    return;
                }
                var currRec_discrate = currRec.getValue({
                    fieldId : "custrecord_cos_discountmatrix_discrate"
                });
                currRec_discrate = Number(currRec_discrate || 0);
                currRec_marginrate = Number(currRec_marginrate || 0);
                var nextMarginRate = null;

                var nextMarginSearch = search.create({
                    type : "customrecord_cos_discountmatrix",
                    filters : ["custrecord_cos_discountmatrix_marginrate", "greaterthan", ""+currRec_marginrate],
                    columns : [
                        search.createColumn({
                            name : "custrecord_cos_discountmatrix_marginrate",
                            sort: search.Sort.ASC,
                        }),
                        // search.createColumn({
                        //     name : "custrecord_cos_discountmatrix_d"
                        // })
                    ]
                });

                nextMarginSearch.run().each(function(res){
                    nextMarginRate = res.getValue({
                        name : "custrecord_cos_discountmatrix_marginrate",
                    });
                    return false;
                })

                log.debug("nextMarginRate", nextMarginRate);
                nextMarginRate = nextMarginRate === null ? null : parseFloat(nextMarginRate || 0);
                log.debug("nextMarginRate", nextMarginRate);
                

                var itemSearchFilters = [];

                if(currRec_marginrate || currRec_marginrate == 0)
                {
                    if(itemSearchFilters.length > 0)
                    {
                        itemSearchFilters.push("AND");
                    }
                    itemSearchFilters.push(["custitemmargin_percent", "greaterthan", /* ""+ */currRec_marginrate])
                }
                if(nextMarginRate || nextMarginRate == 0)
                {
                    if(itemSearchFilters.length > 0)
                    {
                        itemSearchFilters.push("AND");
                    }
                    itemSearchFilters.push(["custitemmargin_percent", "lessthan", /* ""+ */nextMarginRate])
                }

                // //test 1 specific item
                // if(itemSearchFilters.length > 0)
                // {
                //     itemSearchFilters.push("AND");
                // }
                // itemSearchFilters.push(["internalid", "anyof", /* ""+ */[6323]])
                // //01-0002C

                log.debug("itemSearchFilters", itemSearchFilters)

                //search for items to update
                var itemSearch = search.create({
                    type : "item",
                    filters : itemSearchFilters,
                    columns : [
                        search.createColumn({
                            name : "custitemmargin_percent",
                            sort: search.Sort.ASC,
                        }),
                        // search.createColumn({
                        //     name : "recordtype",
                        // })
                    ]
                });
                var fullItemList = [];
                var processedItemList = [];
                var processedItemAssemblyIds = [];
                var batchInfo = {};
                //store results on a list first, so if governance unit runs out, script can have a list of unprocessed, then offload to MR
                var itemsToUpdate = [];
                
                var currentItemCount = 0;
                itemSearch.run().each(function(res){
                    if(currentItemCount < ITEM_COUNT_LIMIT)
                    {
                        fullItemList.push({id : res.id, recordType : res.recordType});
                        itemsToUpdate.push(res.id)
                        currentItemCount++;
                        return PROCESS_ALL_ITEMS;
                    }
                });

                //TODO you can send it in chunks because 1 service call is just 10 units but have its own 1000+ units

                record.submitFields({
                    type : currRec.type,
                    id : currRec.id,
                    values : {
                        custrecord_cos_discountmatrix_p_items : itemsToUpdate
                    }
                })

                log.debug("itemsToUpdate", {itemsToUpdateLength : itemsToUpdate.length, itemsToUpdate});
                var remainingItems = [].concat(itemsToUpdate);
                fullItemList.every(function(res){

                    
                    //TODO offload to SUITELET/RESTLET via https.post, so it can chain trigger the UPPER COMPUTATION for their parent records(assembly/kit components)
                    var itemInternalId = res.id;
                    log.debug("res.recordType", res.recordType);
                    log.debug("itemInternalId", itemInternalId);

                    var itemRec_basePrice = null;
                    //gu 5 units for items
                    var itemRec = record.load({
                        type : res.recordType,
                        id : itemInternalId
                    });
                    var currRec_basePrice = getBasePrice(itemRec, null, true);
                    var currRec_vendorPrice = getVendorPrice(itemRec);

                    itemRec.setSublistValue({
                        sublistId : "price",
                        fieldId : "price_1_",
                        line : 1,
                        value : currRec_basePrice
                    });

                    log.debug("before computing margin")
                    var computeMarginObj = computeMargin(itemRec, currRec_vendorPrice, currRec_basePrice);

                    var priceChange = computePrices(itemRec, null, computeMarginObj);

                    if(priceChange || computeMarginObj)
                    {
                        //gu 10 units for items
                        var updatedItemRecId = itemRec.save({
                            ignoreMandatoryFields : true,
                            allowSourcing : true
                        });
                        // updatedItemRecId = "" + updatedItemRecId;
                        log.debug("updatedItemRecId", updatedItemRecId);
















                        var dmLookup = search.lookupFields({
                            type : currRec.type,
                            id : currRec.id,
                            columns : ["custrecord_cos_discountmatrix_p_items"]
                        });

                        log.debug("dmLookup", dmLookup);

                        log.debug("remainingItems beforeFilter", {itemsToUpdateLength : itemsToUpdate.length, remainingItemsLength : remainingItems.length, remainingItems});
                        if(dmLookup && dmLookup.custrecord_cos_discountmatrix_p_items && dmLookup.custrecord_cos_discountmatrix_p_items.length > 0)
                        {
                            // var itemsToProcessList = (dmLookup.custrecord_cos_discountmatrix_p_items.value).split(",");
                            remainingItems = remainingItems.filter(function(elem){
                                // log.debug("{elem, updatedItemRecId}", {elem, updatedItemRecId})
                                if(elem == updatedItemRecId)
                                {
                                    return false;
                                }
                                else{
                                    return true;
                                }
                            })
                        }
                        log.debug("remainingItems", {remainingItemsLength : remainingItems.length, remainingItems});
                        var updatedDmId = record.submitFields({
                            type : currRec.type,
                            id : currRec.id,
                            values : {
                                custrecord_cos_discountmatrix_p_items : remainingItems
                            }
                        })

                        log.debug("updatedDmId", updatedDmId);



                        

                        var processedItemAssemblyIds = [];
                        //move to library
                        var fileId = getFileId();
                        var fileObj = getFileObj(fileId);
                        var fileContents = getFileContent(fileObj);
    
                        var assemblyItemsSearch = getSearch_assemblyItemsAffected([updatedItemRecId],fileContents);
    
                        var assemblyItemsSr = getResults(assemblyItemsSearch.run());
                        for(var a = 0 ; a < assemblyItemsSr.length ; a++)
                        {
                            var res = assemblyItemsSr[a];
                            var assemblyItemId = res.getValue({
                                name: "internalid",
                                summary: "GROUP",
                                label: "Internal ID"
                            })
                            log.debug("assemblyItemId", assemblyItemId);
    
                            if(!processedItemAssemblyIds.includes(Number(assemblyItemId)))
                            {
                                processedItemAssemblyIds.push(Number(assemblyItemId));
                            }
    
                            processedItemAssemblyIds.push(res.id);
                        }
                        
                        log.debug("processedItemAssemblyIds.length", processedItemAssemblyIds.length)
    
    
                        //why 2 loops?
                        processedItemAssemblyIds.every(function(assemblyItemId){
                            if(!fileContents.includes(assemblyItemId))
                            {
                                fileContents.push(assemblyItemId);
                                log.debug("fileContents", fileContents);
                            }
                        })
    
                        if(fileObj && fileContents)
                        {
                            file.delete({
                                id : fileId
                            })
                            var newFileObj = file.create({
                                folder : 371738,
                                fileType : file.Type.PLAINTEXT,
                                name : "DISCOUNTMATRIX_ASSEMBLYKITS_TOUPDATE",
                                contents : JSON.stringify([...new Set(fileContents)])
                            })
                            var newfileId = newFileObj.save();
                            log.debug("newfileId saved", newfileId)
                        }
                        else
                        {
                            var newFileObj = file.create({
                                folder : 371738,
                                fileType : file.Type.PLAINTEXT,
                                name : "DISCOUNTMATRIX_ASSEMBLYKITS_TOUPDATE",
                                contents : JSON.stringify([...new Set(processedItemAssemblyIds)])
                            })
                            var newfileId = newFileObj.save();
                            log.debug("newfileId saved", newfileId)
                        }
    
                        res.dmId = currRec.id;
    
                        var remainingUsage = runtime.getCurrentScript().getRemainingUsage(); //track how much is remaining so you can offload gracefully
                        log.debug("usage logs", {remainingUsage, OFFLOAD_TRESHOLD})
                        if(remainingUsage < OFFLOAD_TRESHOLD)
                        {
                            log.debug("ending gracefully", {remainingUsage, OFFLOAD_TRESHOLD})
                            //TODO offload to MR. look at batchInfo var
    
    
    
                            var fileId = getFileId();
                            var fileObj = getFileObj(fileId);
                            var fileContents = getFileContent(fileObj);
    
                            if(fileObj && fileContents)
                            {
                                file.delete({
                                    id : fileId
                                });

                                processedItemAssemblyIds.every(function(assemblyItemId){
                                    if(!fileContents.includes(assemblyItemId))
                                    {
                                        fileContents.push(assemblyItemId);
                                        log.debug("fileContents", fileContents);
                                    }
                                })

                                var newFileObj = file.create({
                                    folder : 371738,
                                    fileType : file.Type.PLAINTEXT,
                                    name : "DISCOUNTMATRIX_ASSEMBLYKITS_TOUPDATE",
                                    contents : JSON.stringify([...new Set(remainingItems.concat([...new Set(fileContents)]))])
                                });
                                var newfileId = newFileObj.save();
                                log.debug("newfileId saved", newfileId)
                                }
                                else
                                {
                                    var newFileObj = file.create({
                                        folder : 371738,
                                        fileType : file.Type.PLAINTEXT,
                                        name : "DISCOUNTMATRIX_ASSEMBLYKITS_TOUPDATE",
                                        contents : JSON.stringify([...new Set(fileContents)])
                                    })
                                    var newfileId = newFileObj.save();
                                    log.debug("newfileId saved", newfileId)
                                }
                            
                            return false;
                        }
                        else
                        {
                            return true;
                        }
                    }
                })
                
                var batchInfo = {fullItemList:fullItemList, tpl:currRec_pricelevel, dmId:currRec.id};
                log.debug("batchInfo", batchInfo);
                log.debug("processedItemList", processedItemList);

                startMr(currRec.type, currRec.id);
            }
    	}
    	catch(e)
    	{
    		log.error("ERROR in function afterSubmit", {stack : e.stack, message : e.message});
    	}
    }

    function startMr(recType, recId)
    {
        try{
            var taskObj = task.create({
                taskType : task.TaskType.MAP_REDUCE,
                deploymentId : "customdeploy_cos_mr_dcmatrix",
                scriptId : "customscript_cos_mr_dcmatrix",
                params : {
                    custscript_cos_mr_dmcalledby : recType,
                    custscript_cos_mr_dmid : recId
                }
            });
    
            var taskObj = taskObj.submit();
        }
        catch(e)
        {
            log.error("ERROR in function startMr", e)
        }
        
    }

    function getSearch_assemblyItemsAffected(fileContents, excludedItems)
	{
		var itemSearchObj = search.create({
			type: "item",
			filters:
			[
			   ["type","anyof","Kit","Assembly"],
			   "AND",
			   ["memberitem.internalid","anyof",fileContents]
			],
			columns:
			[
			   search.createColumn({
				  name: "internalid",
				  summary: "GROUP",
				  label: "Internal ID"
			   }),
			   search.createColumn({
				  name: "itemid",
				  summary: "GROUP",
				  sort: search.Sort.ASC,
				  label: "Name"
			   }),
			   search.createColumn({
				  name: "baseprice",
				  join: "memberItem",
				  summary: "SUM",
				  label: "Base Price"
			   }),
			   search.createColumn({
				  name: "memberquantity",
				  summary: "GROUP",
				  label: "Member Quantity"
			   }),
			   search.createColumn({
				  name: "memberbasequantity",
				  summary: "GROUP",
				  label: "Member Quantity in Base Units"
			   }),
			   search.createColumn({
				  name: "formulanumeric",
				  summary: "SUM",
				  formula: "{memberquantity} * {memberitem.price}",
				  label: "Formula (Numeric)"
			   }),
				search.createColumn({
					name: "type",
					summary: "GROUP",
					label: "Type"
				})
			]
		 });
		 return itemSearchObj;
	}

    function getFileObj(fileId)
	{
        var fileObj = null;
		if(fileId)
		{
			fileObj = file.load({
				id : fileId
			});
			
		}
        return fileObj
	}

	function getFileContent(fileObj)
	{
        var fileContents = "";
        if(fileObj)
        {
            fileContents = fileObj.getContents();
        }
		log.debug("fileContents", fileContents);

		if(fileContents)
		{
			fileContents = JSON.parse(fileContents);
		}
		return fileContents || [];
	}

	function getFileId()
	{
		var retVal = {};
		var fileId = "";
		var fileSearchObj = search.create({
			type: "file",
			filters:
			[
			   ["name","is","DISCOUNTMATRIX_ASSEMBLYKITS_TOUPDATE"]
			],
			columns:
			[
			   search.createColumn({
				  name: "name",
				  sort: search.Sort.ASC,
				  label: "Name"
			   }),
			   search.createColumn({name: "folder", label: "Folder"}),
			]
		});

		fileSearchObj.run().each(function(res){
			fileId = res.id
		})

		return fileId;
	}

    var getResults = function getResults(set) {
		var holder = [];
		var i = 0;
		while (true) {
		var result = set.getRange({
			start: i,
			end: i + 1000
		});
		if (!result) break;
		holder = holder.concat(result);
		if (result.length < 1000) break;
		i += 1000;
		}
		return holder;
	};

    function marginMainFormula(cost, price)
    {
        var newMargin = cost ? (1 - (cost / price)) * 100 : 100;
        newMargin = newMargin.toFixed(1);
        return newMargin;
    }

    function getBasePrice(recObj, componentPrices, respectBasePrice)
    {
        var itemRec_basePrice = null;
        if(respectBasePrice)
        {
            itemRec_basePrice = recObj.getSublistValue({
                sublistId : "price",
                fieldId : "price_1_",
                line : "0"
            });
        }
        else if(componentPrices)
        {
            var priceObjKey = "custitemmarkeudisc";
            return componentPrices.reduce((accumulator, componentObj) => accumulator + componentObj[priceObjKey] || 0, 0);
        }
        else
        {
            var pricingType = getPricingType(recObj);
            log.debug("pricingType", pricingType);
            if(pricingType && pricingType.pricingTypeText == "Rival Pricing")
            {
                var rivalPrice1 = recObj.getValue({fieldId : "custitemcompetitorprice1"});
                if(rivalPrice1 || rivalPrice1 === 0)
                {
                    var multiplier = getMultiplier(recObj) || 1;
                    itemRec_basePrice = rivalPrice1 * multiplier;
                }
            }
            else if(pricingType && pricingType.pricingTypeText == "MAP")
            {
                itemRec_basePrice = recObj.getSublistValue({
                    sublistId : "price",
                    fieldId : "price_1_",
                    line : "0"
                });
            }
            else if(pricingType && pricingType.pricingTypeText == "Cost Plus")
            {
                var slsMult = getSlsMult(itemRec);
                var purMult = getPurMult(itemRec);
                var slsPur = slsMult / purMult;
                var multiplier = getMultiplier(recObj) || 1;
                var currRec_vendorPrice = getVendorPrice(recObj);
                var workCost = currRec_vendorPrice / purMult;
                // var workPrice = currRec_basePrice;
                // if(type == "Cost Plus")
                // {
                //     workPrice = workCost * multiplier;
                // }
                itemRec_basePrice = workCost * multiplier * workCost;
            }
            else if(pricingType && pricingType.pricingTypeText == "Rival Pricing")
            {
                var rivalPrice1 = recObj.getValue({fieldId : "custitemcompetitorprice1"});
                if(rivalPrice1 || rivalPrice1 === 0)
                {
                    var multiplier = getMultiplier(recObj) || 1;
                    itemRec_basePrice = rivalPrice1 * multiplier;
                }
            }
            else if(pricingType && pricingType.pricingTypeText == "Manual")
            {
                itemRec_basePrice = recObj.getSublistValue({
                    sublistId : "price",
                    fieldId : "price_1_",
                    line : "0"
                });
            }
            else
            {
                itemRec_basePrice = recObj.getSublistValue({
                    sublistId : "price",
                    fieldId : "price_1_",
                    line : "0"
                });
            }
            
            itemRec_basePrice = Number(itemRec_basePrice || 0); 
            itemRec_basePrice = itemRec_basePrice.toFixed(2);
        }
        return itemRec_basePrice;
    }

    function getPricingType(recObj)
    {
        var pricingTypeVal = recObj.getValue({
            fieldId : "custitempricingtype"
        })
        var pricingTypeText = recObj.getText({
            fieldId : "custitempricingtype"
        })

        if(pricingTypeVal)
        {
            return {pricingTypeVal, pricingTypeText}
        }
    }

    function getVendorPrice(recObj, componentPrices)
    {
        if(componentPrices)
        {
            var priceObjKey = "memberitemitems";
            return componentPrices.reduce((accumulator, componentObj) => accumulator + componentObj[priceObjKey] || 0, 0);
        }
        else
        {
            var retVal = recObj.getValue({
                fieldId : "cost",
            });
            return Number(retVal || 0);
        }
        
    }

    //unused, replaced by function getBasePrice
    function getSalesPrice(recObj)
    {
        var retVal = recObj.getSublistValue({
            sublistId : "price",
            fieldId : "price_1_",
            line : "0"
        });
        return Number(retVal || 0);
    }

    function getPurMult(recObj)
    {
        var retVal = recObj.getValue({
            fieldId : "purchaseconversionrate",
        });
        return Number(retVal || 0);
    }

    function getSlsMult(recObj)
    {
        var retVal = recObj.getValue({
            fieldId : "saleconversionrate",
        });
        return Number(retVal || 0);
    }

    function getMultiplier(recObj)
    {
        var retVal = recObj.getValue({
            fieldId : "custitemmarkeudiscountpercentage",
        });
        return Number(retVal || 1);
    }

    function computeMargin(itemRec, currRec_vendorPrice, currRec_basePrice)
    {
        var type = "";
        var slsMult = getSlsMult(itemRec);
        var purMult = getPurMult(itemRec);
        var slsPur = slsMult / purMult;
        var multiplier = getMultiplier(itemRec) || 1;
        var workCost = getVendorPrice(itemRec) / purMult;
        var workPrice = currRec_basePrice;
        if(type == "Cost Plus")
        {
            workPrice = workCost * slsPur * multiplier;
        }
        var adjCost = slsPur * workCost;
        
        // var newMargin = workCost ? (1 - (adjCost / workPrice)) * 100 : 100;
        var newMargin = marginMainFormula(adjCost, workPrice)
        
        var oldMargin = itemRec.getValue({
            fieldId : "custitemmargin_percent"
        });
        oldMargin = oldMargin !== "" && oldMargin !== null ? oldMargin.toFixed(2) : "";

        log.debug("newMargin", newMargin);
        log.debug("", {workPrice, workCost, currRec_vendorPrice, purMult, multiplier, adjCost, multiplier, slsPur, purMult, slsMult});
        var itemChange = false;
        if(oldMargin !== newMargin)
        {
            itemRec.setValue({
                fieldId : "custitemmargin_percent",
                value : newMargin
            })

        }
        log.debug("{oldMargin, newMargin}", {oldMargin, newMargin})
        
        return {workPrice, workCost, currRec_vendorPrice, purMult, multiplier, adjCost, multiplier, slsPur, purMult, slsMult};
    }

    function roundUp(num)
    {
        var origNum = num;
        num = num || num === 0 ? num : 0;
        //log.debug("immediate toFixed(2)", num.toFixed(2))
        
        num = ""+num;
        log.debug("num=", num.substring(0, 6))
        if(num.substring(num.indexOf('.')).length > 3) //means it have period and >3decimal places
        {
        
            // log.debug("num after substring2", num)
            num = num.substring(0, num.indexOf('.') + 4);
            // log.debug("num after substring3", num)
            // lastDigit = num[num.length-1];
            // // log.debug('lastDigit', lastDigit)
            // if(lastDigit >= ""+5)
            // {
            //     // log.debug('just apply toFixed(2)', num)
            //     num = parseFloat(num).toFixed(2);
            // }
            // else
            // {
            //     lastDigit = 6;
            //     num[num.length - 1] = (""+lastDigit);
            //     // num = num.substring(0, num.length - 1) + (""+lastDigit);
            //     // log.debug("num after replacing 3rd decimal", num);
            //     num = parseFloat(num).toFixed(2);
            // }
            lastDigit = 6;
            num = num.substring(0, num.length - 1) + (""+lastDigit);
        }

        // log.debug('-----final num=' + origNum + " : ", parseFloat(num).toFixed(2))
        return parseFloat(num).toFixed(2);
    }

    function computePrices(itemRec, basePriceOption, computeMarginObj)
    {
        var priceChange = false;
        var itemRec_basePrice = computeMarginObj ? computeMarginObj.workPrice || 0 : getBasePrice(itemRec);
        var targetMargin = itemRec.getValue({
            fieldId : "custitemmargin_percent"
        });

        log.debug("targetMargin", targetMargin);

        var nextMarginRate = null;

        var nextMarginSearch = search.create({
            type : "customrecord_cos_discountmatrix",
            filters : ["custrecord_cos_discountmatrix_marginrate", "lessthan", ""+targetMargin],
            columns : [
                search.createColumn({
                    name : "custrecord_cos_discountmatrix_marginrate",
                    sort: search.Sort.DESC,
                }),
                // search.createColumn({
                //     name : "custrecord_cos_discountmatrix_d"
                // })
            ]
        });

        nextMarginSearch.run().each(function(res){
            nextMarginRate = res.getValue({
                name : "custrecord_cos_discountmatrix_marginrate",
            });
            return false;
        })

        log.debug("nextMarginRate", nextMarginRate);
        nextMarginRate = nextMarginRate === null ? null : parseFloat(nextMarginRate || 0);
        log.debug("nextMarginRate", nextMarginRate);


        var discountMatrixSearch = search.create({
            type : "customrecord_cos_discountmatrix",
            filters : [
                ["custrecord_cos_discountmatrix_marginrate","lessthan",targetMargin], 
                "AND", 
                ["custrecord_cos_discountmatrix_marginrate","greaterthanorequalto",nextMarginRate], 
                "AND", 
                ["custrecord_cos_discountmatrix_marginrate","isnotempty",""], 
                "AND", 
                ["custrecord_cos_discountmatrix_d","noneof","@NONE@"], 
                "AND", 
                ["custrecord_cos_discountmatrix_discrate","isnotempty",""]
            ],
            columns : [
                search.createColumn({
                    name : "custrecord_cos_discountmatrix_marginrate",
                    sort: search.Sort.ASC,
                    summary : "MAX"
                }),
                search.createColumn({
                    name : "internalid",
                    summary : "GROUP"
                }),
                search.createColumn({
                    name : "custrecord_cos_discountmatrix_discrate",
                    summary : "GROUP"
                }),
                search.createColumn({
                    name : "custrecord_cos_discountmatrix_d",
                    summary : "GROUP"
                }),
                search.createColumn({
                    name : "custrecord_cos_discountmatrix_m",
                    summary : "GROUP"
                }),
                // search.createColumn({
                //     name : "custrecord_cos_discountmatrix_d"
                // })
            ]
        });

        discountMatrixSearch.run().each(function(res){

            log.debug("dcm res", res);
            try{
                var priceLevelId = res.getValue({
                    name : "custrecord_cos_discountmatrix_d",
                    summary : "GROUP"
                })
    
                var discountRate = res.getValue({
                    name : "custrecord_cos_discountmatrix_discrate",
                    summary : "GROUP"
                }) || 0;
                var internalId = res.getValue({
                    name : "internalid",
                    summary : "GROUP"
                }) || 0;

                var marginName = res.getValue({
                    name : "custrecord_cos_discountmatrix_m",
                    summary : "GROUP"
                });

                log.debug("{priceLevelId, discountRate, marginName}", {priceLevelId, discountRate, marginName, internalId})
    
                discountRate = parseFloat(discountRate).toFixed(2);
                
                // var computedNewDisc = itemRec_basePrice * discountRate / 100;
                // var computedNewPrice = itemRec_basePrice - computedNewDisc;
    
                //same as the above, but translates better to what's on excel pattern
                var computedNewDisc = itemRec_basePrice - computedNewPrice;
                var computedNewPrice = (1 - (discountRate / 100)) * itemRec_basePrice;


                computedNewPrice = roundUp(computedNewPrice);

                var pricelevelindex = itemRec.findSublistLineWithValue({
                    sublistId : "price",
                    fieldId : "pricelevel",
                    value : ""+priceLevelId
                });

                itemRec.setValue({
                    fieldId : "custitemdiscount_level",
                    value : marginName
                });
    
                log.debug("pricelevelindex", pricelevelindex);
                if(pricelevelindex > -1)
                {
                    var itemRec_currDiscountedPrice = itemRec.getSublistValue({
                        sublistId : "price",
                        fieldId : "price_1_",
                        line : pricelevelindex
                    });
    
                    // computedNewPrice = computedNewPrice.toFixed(2);
                    log.debug("{computedNewDisc, itemRec_currDiscountedPrice}", {itemRec_basePrice, computedNewPrice, computedNewDisc, itemRec_currDiscountedPrice})
    
                    if(computedNewPrice != itemRec_currDiscountedPrice)
                    {
                        itemRec.setSublistValue({
                            sublistId : "price",
                            fieldId : "price_1_",
                            line : pricelevelindex,
                            value : computedNewPrice
                        });
    
                        priceChange = true;
                    }
                }
    
                return true;
            }
            catch(e)
            {
                log.error("ERROR in function discountMatrixSearch.run", e)
            }
        })

        return priceChange;

    }

    //not needed this flag is to know if MR DCMATRIX record should retrigger when DCMatrix is marked cleared by MR
    function beforeSubmit(scriptContext)
    {
        var executionContext = runtime.executionContext;
        log.debug("beforeSubmit executionContext", executionContext);
        log.debug("beforeSubmit scriptContext", scriptContext);
        if(executionContext == "USERINTERFACE")
        {
            scriptContext.newRecord.setValue({
                fieldId : "custpage_cos_dm_status",
                value : "1"
            })
        }
    }
    
    return {
        // beforeLoad: beforeLoad,
        afterSubmit: afterSubmit,
        // beforeSubmit: beforeSubmit,
    };
    
});
