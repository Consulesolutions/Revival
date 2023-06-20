/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

/**
 * @Author Rodmar Dimasaca
 * @Email rod@consulesolutions.com, rjdimasaca@gmail.com
 * @Project Revival Parts
 * @Date May 29, 2023
 * @Filename COS_MR_updateItemInfo.js
 */
define(['N/search', 'N/record'],
function(search, record) {
  
    function getInputData() {
		var salesorderSearchObj = search.create({
			type: "salesorder",
			filters:
			[
			   ["type","anyof","SalesOrd"], 
			   "AND", 
			   ["item.type","anyof","Assembly","Kit","InvtPart"], 
			   "AND", 
			   ["formulanumeric: case when {item.type} = 'Kit/Package' then ({quantity} - {quantityshiprecv})*{item.memberquantity} when {item.type} = 'Assembly/Bill of Materials' then ({quantity} - {quantityshiprecv})*{item.memberquantity} when {item.type} = 'Inventory Item' then {quantity} ELSE 0 end","notequalto","0"],
			//    "AND",
			//    [["item","anyof","20129"],"OR",["item.component","anyof","20129"]]
			],
			columns:
			[
			   search.createColumn({
				  name: "formulatext",
				  summary: "GROUP",
				  formula: "case when {item.type} = 'Inventory Item' then {item} else {item.memberitem} end",
				  label: "Individual Item"
			   }),
			   search.createColumn({
				  name: "formulanumeric",
				  summary: "SUM",
				  formula: "case when {item.type} = 'Kit/Package' then ({quantity} - {quantityshiprecv})*{item.memberquantity} when {item.type} = 'Assembly/Bill of Materials' then ({quantity} - {quantityshiprecv})*{item.memberquantity} when {item.type} = 'Inventory Item' then {quantity} end",
				  label: "QTY ON SO"
			   })
			]
		 });
		 return salesorderSearchObj;
    }
  
    function map(context) {

		try{
			log.debug("map context", context);
			log.debug("map context.value", context.value);
			var contextValue = JSON.parse(context.value);
			// var contextValues = JSON.parse(contextValue.values);
			var contextValues = contextValue.values;
			log.debug("map contextValues", {contextValues, contextValue_length : contextValues.length});

			var itemName = contextValues["GROUP(formulatext)"];
			var qtyOnSo = contextValues["SUM(formulanumeric)"];

			log.debug({itemName, qtyOnSo});

			if(/* qtyOnSo && */ itemName) //still update if 0
			{
				var srObj = search.create({
					type : "inventoryitem",
					filters : ["itemid", "is", itemName]
				});
				srObj.run().each(function(res){
					var submittedItemId = record.submitFields({
						type : "inventoryitem",
						id : res.id,
						values : {
							custitem_cos_cdr_qtyonso : Number(qtyOnSo)
						}
					})
					log.debug("res.id", {"res.id" : res.id, itemName, qtyOnSo, submittedItemId});
					return false;
					
				})
			}
		}
		catch(e)
		{
			log.error("ERROR in function map", e);
		}
		
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
        getInputData: getInputData,
        map: map,
        // reduce: reduce,
        // summarize: summarize
    };
  });