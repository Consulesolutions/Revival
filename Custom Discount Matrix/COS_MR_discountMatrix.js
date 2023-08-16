/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */


/**
 * Script Name          :   COS MR Discount Matrix
 * File Name            :   COS_MR_discountMatrix.js
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
define(['N/search', 'N/record', 'N/file', 'N/task', 'N/runtime'],
function(search, record, file, task, runtime) {
  
    function getInputData() {
		var fileId = getFileId();
		var fileObj = getFileObj(fileId);
		var fileContents = getFileContent(fileObj);

		log.debug("getInputData fileContents", {fileContentsLength : fileContents.length, fileContents});
		if(fileContents && fileContents.length > 0)
		{
			return fileContents;
		}
    }


	function getFileObj(fileId)
	{
        var fileObj = null;
		try{
			if(fileId)
			{
				fileObj = file.load({
					id : fileId
				});
				
			}
		}
		catch(e)
		{
			log.error("ERROR in function getFileObj", e);
		}
		
        return fileObj
	}

	function getFileContent(fileObj)
	{
        var fileContents = "";
		try{
			if(fileObj)
			{
				fileContents = fileObj.getContents();
			}
			log.debug("fileContents", fileContents);

			if(fileContents)
			{
				fileContents = JSON.parse(fileContents);
			}
		}
		catch(e)
		{
			log.error("ERROR in function getFileContent", e);
		}
        
		return fileContents || [];
	}

	function getFileId()
	{
		var retVal = {};
		var fileId = "";

		try{
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
		}
		catch(e)
		{
			log.error("ERROR in function getFileId", e);
		}
		return fileId;

		
	}

	function map(context) {

		try{
			log.debug("map context", context);
			log.debug("map context.value", context.value);
			var contextValue = JSON.parse(context.value);

			updateRecord(contextValue);

		}
		catch(e)
		{
			log.error("ERROR in function map", e);
		}
		
    }

	function updateAssemblyPrice(contextValues)
	{
		log.debug("updateAssemblyPrice contextValues", contextValues);
		if(contextValues["GROUP(internalid)"].value)
		{
			//TODO problem with mandatory fields
			// var submittedRecId = record.submitFields({
			// 	type : contextValues["GROUP(type)"].value == "Assembly" ? "assemblyitem" : "kititem",
			// 	id : contextValues["GROUP(internalid)"].value,
			// 	values : {
			// 		baseprice : contextValues["SUM(formulanumeric)"].value
			// 	}
			// });

			var recObj = record.load({
				type : contextValues["GROUP(type)"].value == "Assembly" ? "assemblyitem" : "kititem",
				id : contextValues["GROUP(internalid)"].value,
			});

			//just resubmit MR will trigger the UES
			// recObj.setSublistValue({
			// 	sublistId : "price",
			// 	fieldId : "price_1_",
			// 	line : "0",
			// 	value : parseFloat(contextValues["SUM(formulanumeric)"]).toFixed(2)
			// });

			var submittedRecId = recObj.save({
				ignoreMandatoryFields : true,
				allowSourcing : true
			})
			log.debug("submittedRecId", submittedRecId);

			var fileId = getFileId();
			log.debug("c fileId", fileId)
			var fileObj = getFileObj(fileId);
			log.debug("c fileObj", fileObj)
			var fileContents = getFileContent(fileObj);
			log.debug("c fileContents", fileContents)

			log.debug("old fileContents", fileContents);

			if(fileContents.includes(submittedRecId))
			{
				
				log.debug("included in old file", submittedRecId);
				fileContents = fileContents.filter(function(elem){
					if(elem == submittedRecId)
					{
						return false;
					}
					else{
						return true;
					}
				});


				if(fileObj && fileContents)
				{
					file.delete({
						id : fileId
					})
					var newFileObj = file.create({
						folder : 371738,
						fileType : file.Type.PLAINTEXT,
						name : "DISCOUNTMATRIX_ASSEMBLYKITS_TOUPDATE",
						contents : JSON.stringify(fileContents)
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
						contents : JSON.stringify([fileContents])
					})
					var newfileId = newFileObj.save();
					log.debug("newfileId saved", newfileId)
				}
			}
		}
	}

	function updateRecord(contextValues)
	{
		log.debug("updateRecord contextValues", contextValues);
		// log.debug("updateRecord contextValues.length", contextValues.length);
		// if(contextValues["GROUP(internalid)"].value)
		if(contextValues)
		{
			//TODO problem with mandatory fields
			// var submittedRecId = record.submitFields({
			// 	type : contextValues["GROUP(type)"].value == "Assembly" ? "assemblyitem" : "kititem",
			// 	id : contextValues["GROUP(internalid)"].value,
			// 	values : {
			// 		baseprice : contextValues["SUM(formulanumeric)"].value
			// 	}
			// });

			var recObj = "";
			var rectypeIds = ["inventoryitem", "assemblyitem", "kititem"]
			for(var a = 0 ; a < rectypeIds.length ; a++){
				try{
					recObj = record.load({
						type : rectypeIds[a],
						id : contextValues,
					});

					if(recObj)
					{
						break;
					}
				}
				catch(e)
				{
					log.debug("not " +  rectypeIds[a], e.message)
				}
				
			}
			
			

			var submittedRecId = recObj.save({
				ignoreMandatoryFields : true,
				allowSourcing : true
			});
			submittedRecId = Number(submittedRecId);
			log.debug("submittedRecId", submittedRecId);
		}
	}

	//unused, move to library
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

	function summarize()
	{
		var dmId = runtime.getCurrentScript().getParameter({
			name : "custscript_cos_mr_dmid"
		})

		log.debug("summarize DMID", dmId);
		if(dmId)
		{
			var clearedDmId = record.submitFields({
				type : "customrecord_cos_discountmatrix",
				id : dmId,
				values : {
					custrecord_cos_discountmatrix_p_items : "",
					custpage_cos_dm_status : "1"
				}
			});
			log.debug("clearedDmId", clearedDmId);
		}
		
		//call mr again for leftovers or missed timings
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
  
    return {
        getInputData: getInputData,
        map: map,
        // reduce: reduce,
        summarize: summarize
    };
  });
