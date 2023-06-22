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
 * @Filename COS_MR_consumptionDemandReport.js
 */
define(['N/search', 'N/email', 'N/runtime', 'N/file', './COS_LIB_consumptionDemandReport.js'],
function(search, email, runtime, file, config) {
  
    function getInputData() {
		var decodedParams = getParams();
		log.debug("getInputData decodedParams", decodedParams)
		if(decodedParams.savedSearchIds)
		{
			return decodedParams.savedSearchIds;
		}
        return [runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s1'}), runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s2'})];
    }
  
    function map(context) {
        //better to run in reduce stage for less limitations
    }

    function getDataFromSearch(context, searchId, decodedParams)
	{
        decodedParams = decodedParams ? decodedParams : {};
		var dataFromSearch = [];
		try
		{
			var base_searchObj = search.load({
				id : searchId
			});

			var newFilters = base_searchObj.filters;
			if(searchId === runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s2'}))
			{
				if(decodedParams.param_dateFrom)
				{
					newFilters.push(search.createFilter({
						name : "trandate",
						join : "fulfillingTransaction",
						operator : "onorafter",
						values : decodedParams.param_dateFrom
					}))
				}
				if(decodedParams.param_dateTo)
				{
					newFilters.push(search.createFilter({
						name : "trandate",
						join : "fulfillingTransaction",
						operator : "onorbefore",
						values : decodedParams.param_dateTo
					}))
				}
			}
			else
			{
				if(decodedParams.param_dateFrom)
				{
					newFilters.push(search.createFilter({
						name : "trandate",
						operator : "onorafter",
						values : decodedParams.param_dateFrom
					}))
				}
				if(decodedParams.param_dateTo)
				{
					newFilters.push(search.createFilter({
						name : "trandate",
						operator : "onorbefore",
						values : decodedParams.param_dateTo
					}))
				}
				
			}
			
			// if(decodedParams.param_items && decodedParams.param_items.length > 0 && (decodedParams.param_items != undefined && decodedParams.param_items != "undefined"))
			// {
			// 	newFilters.push(search.createFilter({
			// 		name : "item",
			// 		operator : "anyof",
			// 		values : decodedParams.param_items.split(",")
			// 	}))
			// }
			if(decodedParams.param_itemsText && decodedParams.param_itemsText.length > 0 && (decodedParams.param_itemsText != undefined && decodedParams.param_itemsText != "undefined"))
			{
				newFilters.push(search.createFilter({
					name : "formulanumeric",
					operator : search.Operator.EQUALTO,
					values : "1",
					formula : `CASE WHEN {item} IN (${decodedParams.param_itemsText}) THEN 1 WHEN {item.memberitem} IN (${decodedParams.param_itemsText}) THEN 1 ELSE 0 END`
				}))
			}

			log.debug("getDataFromSearch:" + searchId + "newFilters", newFilters);
			var searchObj = search.create({
				type : base_searchObj.searchType,
				filters : newFilters,
				columns : base_searchObj.columns
			})

			log.debug("searchObj", searchObj);
			var sr = getResults(searchObj.run());
            return {sr:sr, searchObj:searchObj}
		}
		catch(e)
		{
			log.error("ERROR in function getDataFromSearch", e);
		}
		log.debug("getDataFromSearch1 dataFromSearch", dataFromSearch);
		return dataFromSearch;
	}

	function getParams(context)
	{
		var initialParamsStr = runtime.getCurrentScript().getParameter({
			name : "custscript_cos_mr_cdr_params"
		});
		log.debug("initialParamsStr", initialParamsStr);
		var initialParamsObj = initialParamsStr ? JSON.parse(initialParamsStr) : {};

		var decodedParams = initialParamsObj;
		decodedParams.param_items = (initialParamsObj.param_items);
		decodedParams.param_dateFrom = (initialParamsObj.param_dateFrom);
		decodedParams.param_dateTo = (initialParamsObj.param_dateTo);
		decodedParams.param_itemsText = (initialParamsObj.param_itemsText);

		// decodedParams.param_items = decodeURIComponent(initialParamsObj.items);
		// decodedParams.param_dateFrom = decodeURIComponent(initialParamsObj.dateFrom);
		// decodedParams.param_dateTo = decodeURIComponent(initialParamsObj.dateTo);
		
		
		log.debug("decodedParams", decodedParams);
		return decodedParams;
	}
  
    function reduce(context) {

        log.debug("reduce context", context);
        log.debug("reduce context.values", context.values);
        log.debug("reduce context.values.length", context.values.length);

        var searchId = context.values[0];
        var decodedParams = getParams(context);
		// decodedParams = {param_dateFrom:"1/1/2023", param_dateTo:"3/31/2023"}
		
		log.debug("reduce:searchId", searchId);
		var combinedData = [];
		try
		{
            var functionRes = getDataFromSearch(context, searchId, decodedParams);
            var sr = functionRes.sr;
            var searchObj = functionRes.searchObj;

            log.debug("sr", sr);
			if(sr && sr.length > 0)
			{
				for(var a = 0 ; a < sr.length ; a++)
				{
					var result = sr[a];
					var sr_obj = {
					};
					searchObj.columns.forEach(function(col){
						sr_obj[col.label] = {val:result.getValue(col), txt:result.getText(col)}
					})
					// dataFromSearch.push(sr_obj);

                    context.write({
                        key: sr_obj["Individual Item"].val,
                        value: sr_obj
                    });
				}
			}
		}
		catch(e)
		{
			log.error("ERROR in function reduce", e);
		}
		log.debug("combinedData", combinedData);
    }
  
    function summarize(summary) {

		var startYear = 2019;
		var startMonth = 0;
		var endYear = new Date().getFullYear();
		var endMonth = 0;
		
		var combinedData = [];
		summary.output.iterator().each(function (key, value) {
            combinedData.push({key:key, value:value})
            return true;
        });

		log.debug("summarize combinedData", combinedData)
		var list = combinedData;
		var groupByIndividualItem = list.reduce(function(group, obj){
				var value = JSON.parse(obj["value"]);
				var baseAttr = obj["key"];
				var attr = baseAttr;
				group[attr] = group[attr] || [];
				group[attr].push(value);

				return group;
			},
		{});

		log.debug("summarize groupByIndividualItem", groupByIndividualItem);

        var decodedParams = getParams(summary);


		if(decodedParams.param_dateFrom)
		{
			startYear = new Date(decodedParams.param_dateFrom).getFullYear();
			startMonth = decodedParams.param_dateFrom ? new Date(decodedParams.param_dateFrom).getMonth() : 0;
		}
		if(decodedParams.param_dateTo)
		{
			endYear = new Date(decodedParams.param_dateTo).getFullYear();
			endMonth = decodedParams.param_dateTo ? new Date(decodedParams.param_dateTo).getMonth() : 0;
		}

		for(var item in groupByIndividualItem)
		{
			var itemInfo = {};
			itemInfo.grandTotal = 0;
			var list = groupByIndividualItem[item] ? groupByIndividualItem[item] : [];
		
			// log.debug("summarize dataFromSearch3 item list", {item, list});
	
			var groupByAccPeriod_year = list.reduce(function(group, obj){
					var baseAttr = obj.Period.txt;
					var spaceIndex = baseAttr.indexOf(" ");
					var year = baseAttr.slice(spaceIndex+1)
					var attr = year;
					group[attr] = group[attr] || [];
					group[attr].push(obj);
					return group;
				},
			{});
	
			// log.debug("groupByAccPeriod_year", groupByAccPeriod_year);
			for(var year in groupByAccPeriod_year)
			{
				var list = groupByAccPeriod_year[year];
				var groupByAccPeriod = list.reduce(function(group, obj){
					var baseAttr = obj.Period.txt;
					var attr = baseAttr;
					
					if(group[attr])
					{
						group[attr].Fulfilled.val = Number(group[attr].Fulfilled.val) + Number(obj["Fulfilled"].val);
					}
					else
					{
						group[attr] = {};
						group[attr].Fulfilled = {};
						group[attr].Fulfilled.val = 0;
						group[attr].Fulfilled.val = Number(group[attr].Fulfilled.val) + Number(obj["Fulfilled"].val);
					}
					itemInfo.grandTotal += Number(obj["Fulfilled"].val);
	
					return group;
					},
				{});
	
				groupByAccPeriod_year[year] = {periodList:groupByAccPeriod}
			}
	
			groupByIndividualItem[item] = {yearList : groupByAccPeriod_year, itemInfo : itemInfo};
		}

		log.debug("groupByIndividualItem", groupByIndividualItem);

		
		var fileObj = file.create({
			name:"Consumption Demand Report_" + new Date().getTime() + ".csv",
			// fileType: file.Type.HTMLDOC,
			fileType: file.Type.CSV,
		});
		fileObj.folder = 365499;
		var fileObj = config.getCsvResults(fileObj, groupByIndividualItem, startYear, startMonth, endYear, endMonth);


		email.send({
			author: runtime.getCurrentUser().id,
			recipients: runtime.getCurrentUser().id,
			subject : "Consumption Demand Report",
			body : "Please see attached file. This report is based on the following date range filters:" + 
			`
			date from = ${decodedParams.param_dateFrom},
			date to = ${decodedParams.param_dateTo},
			`,
			attachments : [fileObj]
		})

		log.debug("fileObj.size", fileObj.size);
		// var fileId = fileObj.save();
		// log.debug("fileId", fileId);

		return;
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
        // map: map,
        reduce: reduce,
        summarize: summarize
    };
  });