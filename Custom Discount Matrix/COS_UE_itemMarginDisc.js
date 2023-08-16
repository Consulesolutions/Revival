/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/**
 * Script Name          :   COS UE Item Margin Disc
 * File Name            :   COS_UE_itemMarginDisc.js
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
define(['N/record', 'N/search', 'N/runtime', 'N/query', 'N/file', 'N/task'],
/**
 * @param {record} record
 * @param {search} search
 * @param {runtime} runtime
 */
function(record, search, runtime, query, file, task) {
   
    //test data
    //item id 33412 0% M1
    //item id 1812 30% M2

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
            var priceObjKey = "price";
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
                    itemRec_basePrice = rivalPrice1 /* * multiplier */;
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
                workCost = workCost.toFixed(2);
                // var workPrice = currRec_basePrice;
                // if(type == "Cost Plus")
                // {
                //     workPrice = workCost * multiplier;
                // }
                itemRec_basePrice = workCost /* * multiplier */ * workCost;
                itemRec_basePrice = itemRec_basePrice * slsPur;
                itemRec_basePrice = roundUp(itemRec_basePrice);
            }
            else if(pricingType && pricingType.pricingTypeText == "Rival Pricing")
            {
                var rivalPrice1 = recObj.getValue({fieldId : "custitemcompetitorprice1"});
                if(rivalPrice1 || rivalPrice1 === 0)
                {
                    var multiplier = getMultiplier(recObj) || 1;
                    itemRec_basePrice = rivalPrice1 /* * multiplier */;
                }
            }
            else if(pricingType && pricingType.pricingTypeText == "Manual")
            {
                itemRec_basePrice = recObj.getSublistValue({
                    sublistId : "price",
                    fieldId : "price_1_",
                    line : "0"
                });
                itemRec_basePrice = itemRec_basePrice * slsPur;
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
            var priceObjKey = "cost";
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
        var pricingType = getPricingType(itemRec).pricingTypeText;
        var slsMult = getSlsMult(itemRec);
        var purMult = getPurMult(itemRec);
        var slsPur = slsMult / purMult;
        var multiplier = getMultiplier(itemRec) || 1;
        var workCost = (getVendorPrice(itemRec).toFixed(2)) / purMult; //toFixed2 copies excel behavior
        workCost = workCost.toFixed(2); //copy excel rounding - its formula, but lets keep this anyway
        var workPrice = currRec_basePrice;
        if(pricingType == "Cost Plus")
        {
            // workPrice = workCost * slsPur * multiplier;
            workPrice = workCost * slsPur;
        }
        workPrice = roundUp(workPrice);
        var adjCost = slsPur * workCost;
        // adjCost = adjCost.toFixed(2);
        
        // var newMargin = workCost ? (1 - (adjCost / workPrice)) * 100 : 100;
        var newMargin = marginMainFormula(adjCost, workPrice)
        
        var oldMargin = itemRec.getValue({
            fieldId : "custitemmargin_percent"
        });
        oldMargin = oldMargin !== "" && oldMargin !== null ? oldMargin.toFixed(2) : "";

        log.debug("newMargin", newMargin);
        log.debug("LOOOG", {workPrice, workCost, currRec_vendorPrice, purMult, multiplier, adjCost, multiplier, slsPur, purMult, slsMult});
        var itemChange = false;
        if(oldMargin !== newMargin)
        {
            itemRec.setValue({
                fieldId : "custitemmargin_percent",
                value : newMargin
            })

            itemChange = true;
        }
        log.debug("{oldMargin, newMargin}", {oldMargin, newMargin})
        
        return {workPrice, workCost, currRec_vendorPrice, purMult, multiplier, adjCost, multiplier, slsPur, purMult, slsMult};
        return itemChange;
    }

    function roundUp(num, decimalPlaces)
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
        itemRec_basePrice = basePriceOption ? basePriceOption : itemRec_basePrice
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

        var filters = [];
        filters = [ 
        ["custrecord_cos_discountmatrix_marginrate","isnotempty",""], 
        "AND", 
        ["custrecord_cos_discountmatrix_d","noneof","@NONE@"], 
        "AND", 
        ["custrecord_cos_discountmatrix_discrate","isnotempty",""]];
        if(targetMargin && targetMargin !== "0.0")
        {
            filters = filters.concat(
                ["AND", 
                ["custrecord_cos_discountmatrix_marginrate","lessthan",targetMargin]]
            )
        }
        else{
            filters = filters.concat(
                ["AND", 
                ["custrecord_cos_discountmatrix_marginrate","lessthanorequalto",targetMargin]]
            )
        }
        if(nextMarginRate)
        {
            filters = filters.concat(
                ["AND", 
                ["custrecord_cos_discountmatrix_marginrate","greaterthanorequalto",nextMarginRate]]
            )
        }

        log.debug("filters", filters)

        var discountMatrixSearch = search.create({
            type : "customrecord_cos_discountmatrix",
            filters : filters,
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
    
    
                        if(res.recordType == "inventorypart") //if not kit item  and not assembly
                        {
    
                        }
                        else
                        {
                            
                        }
                    }
                }
    
                return true;
            }
            catch(e)
            {
                log.error("ERROR in function discountMatrixSearch.run", e)
            }
        })

        return true;

    }


    //just get the info needed for formula
    function getPriceQuery(itemId)
    {
        var sql = 
        `SELECT 
        BUILTIN_RESULT.TYPE_FLOAT((itemMember_SUB.cost_0) * itemMember_SUB.quantity) AS cost /*({member.item^item.saleunit.conversionrate} / {member.item^item.purchaseunit.conversionrate} * {member.item^item.cost}) * {member.quantity}*/, 
  BUILTIN_RESULT.TYPE_FLOAT(CASE WHEN BUILTIN.DF(item.itemtype) = 'Inventory Item' THEN ((item.custitemmarkeudiscountpercentage * itemMember_SUB.price_0) * itemMember_SUB.quantity) + CASE WHEN BUILTIN.DF(item.custitempricingtype) = 'Rival Pricing' THEN itemMember_SUB.custitemlaborcost_0 * itemMember_SUB.quantity ELSE 0 END ELSE ((item.custitemmarkeudiscountpercentage * itemMember_SUB.price_0) * itemMember_SUB.quantity) + CASE WHEN BUILTIN.DF(item.custitempricingtype) = 'Comp Retail w/Labor' THEN itemMember_SUB.custitemlaborcost_0 * itemMember_SUB.quantity ELSE 0 END END) AS "price" /*CASE WHEN {itemtype#display} = 'Inventory Item' THEN ({custitemmarkeudiscountpercentage} * {member.item^item.price.price} * {member.quantity}) + (CASE WHEN {custitempricingtype#display} = 'Rival Pricing' THEN {member.item^item.custitemlaborcost} * {member.quantity} ELSE 0 END) ELSE ({custitemmarkeudiscountpercentage} * {member.item^item.price.price} * {member.quantity}) + (CASE WHEN {custitempricingtype#display} = 'Comp Retail w/Labor' THEN {member.item^item.custitemlaborcost} * {member.quantity} ELSE 0 END) END*/
      FROM 
        item, 
        (SELECT 
          itemMember.parentitem AS parentitem, 
          itemMember.parentitem AS parentitem_join, 
          item_SUB.conversionrate AS conversionrate_0, 
          item_SUB.conversionrate_0 AS conversionrate_0_0, 
          item_SUB."COST" AS cost_0, 
          itemMember.quantity AS quantity, 
          item_SUB.price AS price_0, 
          item_SUB.custitemlaborcost AS custitemlaborcost_0, 
          item_SUB.pricelevelname_crit AS pricelevelname_crit_0
        FROM 
          itemMember, 
          (SELECT 
            item_0."ID" AS "ID", 
            item_0."ID" AS id_join, 
            unitsTypeUom_0.conversionrate AS conversionrate, 
            unitsTypeUom.conversionrate AS conversionrate_0, 
            item_0."COST" AS "COST", 
            itemPrice.price AS price, 
            item_0.custitemlaborcost AS custitemlaborcost, 
            itemPrice.pricelevelname AS pricelevelname_crit
          FROM 
            item item_0, 
            itemPrice, 
            unitsTypeUom, 
            unitsTypeUom unitsTypeUom_0
          WHERE 
            ((item_0."ID" = itemPrice.item(+) AND item_0.purchaseunit = unitsTypeUom.internalid(+)))
             AND item_0.saleunit = unitsTypeUom_0.internalid(+)
          ) item_SUB
        WHERE 
          itemMember.item = item_SUB."ID"(+)
        ) itemMember_SUB
      WHERE 
        item."ID" = itemMember_SUB.parentitem(+)
         AND ((item."ID" = ${itemId} AND UPPER(itemMember_SUB.pricelevelname_crit_0) = 'BASE PRICE'))`

         var pagedResults = query.runSuiteQLPaged({
            query: sql,
            pageSize: 1000
        })
        var outputData = [];

        pagedResults.iterator().each(function(resultPage) {
            // log.debug("resultPage", resultPage)
            outputData = outputData.concat(resultPage.value.data.asMappedResults());
            return true;
        });

        log.debug("outputData", outputData);

        return outputData;
    }

    
    function marginMainFormula(cost, price, itemRec)
    {
        if(itemRec && (itemRec.type == "assemblyitem" || itemRec.type == "kititem"))
        {
            var newMargin = cost ? (1 - (cost / price)) * 100 : 100;
            newMargin = newMargin.toFixed(); //like in excel
            return newMargin;
            
        }
        else{
            var newMargin = cost ? (1 - (cost / price)) * 100 : 100;
            newMargin = newMargin.toFixed(1); //like in excel
            return newMargin;
        }
        
    }

    function afterSubmit(scriptContext)
    {
    	try
    	{
            if(scriptContext.type == "xedit" || scriptContext.type == "edit" || scriptContext.type == "create")
            {
                var currRec = scriptContext.newRecord;

                if(currRec.type == "assemblyitem" || currRec.type == "kititem")
                {
                    var itemRec = record.load({
                        type : scriptContext.newRecord.type,
                        id : scriptContext.newRecord.id
                    });

                    var pricingType = getPricingType(recObj);
                    if(!pricingType.pricingTypeText)
                    {
                        return;
                    }

                    var priceQuery = getPriceQuery(itemRec.id);

                    var basePrice = getBasePrice(null, priceQuery);
                    var vendorPrice = getVendorPrice(null, priceQuery);

                    log.debug("assembly kit", {basePrice, vendorPrice})
                    var newMargin = marginMainFormula(vendorPrice, basePrice, itemRec);
                    log.debug("assembly kit newMargin", newMargin)

                    itemRec.setValue({
                        fieldId : "custitemmargin_percent",
                        value : newMargin
                    });

                    var priceChange = computePrices(itemRec, basePrice, null);

                    var updatedItemRecId = "";
                    if(priceChange)
                    {
                        updatedItemRecId = itemRec.save({
                            ignoreMandatoryFields : true,
                            allowSourcing : true
                        })

                        log.debug("ASSEMBLY/KIT ITEM UPDATED", updatedItemRecId);
                    }


                    var fileId = getFileId();
                    var fileObj = getFileObj(fileId);
                    var fileContents = getFileContent(fileObj);

                    if(fileObj && fileContents)
                    {
                        fileContents = fileContents.filter(function(elem){
                            // log.debug("{elem, updatedItemRecId}", {elem, updatedItemRecId})
                            if(elem == updatedItemRecId)
                            {
                                return false;
                            }
                            else{
                                return true;
                            }
                        });
                        log.debug("fileContents without updatedItemRecId", {updatedItemRecId, fileContentsLength : fileContents.length, fileContents})

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
                        log.debug("newfileId modified-saved", newfileId)
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
                        log.debug("newfileId missing-saved", newfileId)
                    }
                }
                else
                {
                    var pricingType = getPricingType(currRec);
                    
                    var updatedItemRecId = currRec.id;
                    var currRec_basePrice = getBasePrice(currRec, null, true);
                    var currRec_vendorPrice = getVendorPrice(currRec);

                    if((currRec_basePrice || currRec_basePrice === 0) && (currRec_vendorPrice || currRec_vendorPrice === 0) && pricingType.pricingTypeVal)
                    {
                        //compute margin
                        var itemRec = record.load({
                            type : scriptContext.newRecord.type,
                            id : scriptContext.newRecord.id
                        });

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
                            updatedItemRecId = itemRec.save({
                                ignoreMandatoryFields : true,
                                allowSourcing : true
                            })
                            log.debug("updatedItemRecId", updatedItemRecId);
                        }
                    }

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
                            name: "internalid",/* 
                            summary: "GROUP",
                            label: "Internal ID" */
                        })
                        log.debug("assemblyItemId", assemblyItemId);

                        if(!processedItemAssemblyIds.includes(Number(assemblyItemId)))
                        {
                            processedItemAssemblyIds.push(Number(assemblyItemId));
                        }
                    }


                    //why 2 loops?
                    processedItemAssemblyIds.every(function(assemblyItemId){
                        if(!fileContents.includes(assemblyItemId))
                        {
                            fileContents.push(assemblyItemId);
                            log.debug("fileContents in PI", fileContents);
                        }

                        return true;
                    })

                    if(fileObj && fileContents)
                    {
                        fileContents = fileContents.filter(function(elem){
                            // log.debug("{elem, updatedItemRecId}", {elem, updatedItemRecId})
                            if(elem == updatedItemRecId)
                            {
                                return false;
                            }
                            else{
                                return true;
                            }
                        });
                        log.debug("fileContents without updatedItemRecId", {updatedItemRecId, fileContentsLength : fileContents.length, fileContents})

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
                        log.debug("newfileId modified-saved", newfileId)
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
                        log.debug("newfileId missing-saved", newfileId)
                    }
                }
            }
    	}
    	catch(e)
    	{
    		log.error("ERROR in function afterSubmit", {stack : e.stack, message : e.message});
    	}
        startMr();
    }

    function startMr()
    {
        try{
            var taskObj = task.create({
                taskType : task.TaskType.MAP_REDUCE,
                deploymentId : "customdeploy_cos_mr_dcmatrix",
                scriptId : "customscript_cos_mr_dcmatrix",
                params : {
                    custscript_cos_mr_dmcalledby : runtime.getCurrentScript().id
                }
            });
    
            var taskObj = taskObj.submit();
        }
        catch(e)
        {
            log.error("ERROR in function startMr", e)
        }
        
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
		log.debug("getFileContent fileContents", fileContents);

		if(fileContents)
		{
			fileContents = JSON.parse(fileContents);
		}
		log.debug("getFileContent fileContents", {fileContentsLength : fileContents.length, fileContents});
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
				  name: "internalid",/* 
				  summary: "GROUP",
				  label: "Internal ID" */
			   })
			]
		 });
		 return itemSearchObj;
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
    
    return {
        // beforeLoad: beforeLoad,
        afterSubmit: afterSubmit,
    };
    
});
