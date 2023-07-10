/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

/**
 * @Author Rodmar Dimasaca
 * @Email rod@consulesolutions.com
 * @Project Revival Parts
 * @Date May 29, 2023
 * @Filename COS_SL_consumptionDemandReport.js
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/file', 'N/task', './COS_LIB_consumptionDemandReport.js'],
function(ui, search, runtime, file, task, config) {
	/**
	 * Creates the form based on the config file provided
	 * Defaulting is done after form creation
	 * @param {object} config the config object to reference the form structure
	 * @param {string} config.title the form title
	 * @param {array} config.fieldGroups array of field group objects
	 * @param {array} config.fields array of field objects
	 * @param {array} config.sublists array of sublist objects
	 * @param {array} config.buttons array of buttons objects for the form
	 * @param {string} config.clientScriptModulePath absolute path to the form script
	 * @param {string} config.clientScirptFileId file id for the form script
	 */
	function createSlForm(config, context) {

		var form = ui.createForm({ title: config.title , hideNavBar : true});
			config.tabs.forEach(function(tab) {
			form.addTab(tab);
		});
		config.fieldGroups.forEach(function(fieldGroup) {
			form.addFieldGroup(fieldGroup);
		});
		config.fields.forEach(function(field) {
			var fld = form.addField(field);
			if (field.isMandatory) fld.isMandatory = true;
			if (field.display) {
			fld.updateDisplayType({ displayType: field.display });
			}
			if (field.defaultvalue) {
				fld.defaultValue = field.defaultvalue;
			}
		});

		var itemField = form.getField({
			id : "_items"
		});
		if(context.request.parameters.lockitem)
		{
			itemField.defaultValue = context.request.parameters.lockitem;
			itemField.updateDisplayType({ displayType : "hidden"})
		}

		config.sublists.forEach(function(sublist) {
			var list = form.addSublist(sublist.props);
			sublist.fields.forEach(function(field) {
			var fld = list.addField(field);
			if (field.isMandatory) fld.isMandatory = true;
			if (field.display) {
				fld.updateDisplayType({ displayType: field.display });
			}
			});
		});
		config.customButtons.forEach(function(btn) {
			form.addButton(btn);
		});
		var clientScriptPath = config.clientScriptModulePath || '';
		if (clientScriptPath) form.clientScriptModulePath = clientScriptPath;
		var clientScriptId = config.clientScriptId || '';
		if (clientScriptId) form.clientScriptFileId = clientScriptId;

		return form;
	}

	/**
	 *
	 * @param {serverWidget.Form} form form to default values
	 * @param {https.serverRequest} req request object
	 */
	function defaultFormValues(form, req) {
		var defaultValues = {
			_resultsarea: config.getResultsHeader()
		};
		form.updateDefaultValues(defaultValues);
		return form;
	}

	/**
	 * Creates interface for processing billing
	 * @param {object} context
	 * @param {https.serverRequest} context.request
	 * @param {https.serverResponse} context.response
	 */
	function onRequest(context) {
		
		try
		{
			var listResultsObj = {list : []};
			log.debug("context.request.body", context.request.body);
			log.debug("context.request.parameters", context.request.parameters);
			var body = "";
			if(context.request.body)
			{
				body = JSON.parse(context.request.body);
				log.debug("body", body);
			}
			if(context.request.parameters.requestaction == "getlist")
			{
				var param_items = decodeURIComponent(context.request.parameters.items);
				var param_dateFrom = decodeURIComponent(context.request.parameters.dateFrom);
				var param_dateTo = decodeURIComponent(context.request.parameters.dateTo);
				var param_itemsText = decodeURIComponent(context.request.parameters.itemsText);
				
				var decodedParams = {param_dateFrom:param_dateFrom,param_dateTo:param_dateTo};
				if(context.request.parameters.items)
				{
					decodedParams.param_items = param_items;
				}
				if(context.request.parameters.itemsText)
				{
					var values = param_itemsText.split(","); // Split the input string into an array of values
		
					var outputString = values.map(function(value) {
					return "'" + value.trim() + "'"; // Enclose each value in single quotes
					}).join(","); // Join the values back into a comma-separated string
					decodedParams.param_itemsText = outputString;
				}








				listResultsObj = getListResultsObj(context, decodedParams);
				listResultsObj.success = true;
				listResultsObj.status = 200;
				listResultsObj_asResponse = JSON.stringify(listResultsObj); 
				log.debug("listResultsObj_asResponse", listResultsObj_asResponse)
				context.response.write(listResultsObj_asResponse);
				return;
			}
			if(context.request.parameters.requestaction == "export")
			{
				var param_items = decodeURIComponent(context.request.parameters.items);
				var param_dateFrom = decodeURIComponent(context.request.parameters.dateFrom);
				var param_dateTo = decodeURIComponent(context.request.parameters.dateTo);
				var param_itemsText = decodeURIComponent(context.request.parameters.itemsText);
				
				var decodedParams = {param_dateFrom:param_dateFrom,param_dateTo:param_dateTo};
				if(context.request.parameters.items)
				{
					decodedParams.param_items = param_items;
				}
				if(context.request.parameters.itemsText)
				{
					var values = param_itemsText.split(","); // Split the input string into an array of values
		
					var outputString = values.map(function(value) {
					return "'" + value.trim() + "'"; // Enclose each value in single quotes
					}).join(","); // Join the values back into a comma-separated string
					decodedParams.param_itemsText = outputString;
				}

				
				exportResults(context, decodedParams);
			}
			else
			{
				var form = createSlForm(config.reportForm, context);
				form = defaultFormValues(form, context.request);
				context.response.writePage(form);
				return;
			}
		}
		catch(e)
		{
			log.error("ERROR on function onRequest", e);
			// if(context.request.parameters.requestaction == "getlist")
			// {
			// 	log.debug("ERROR on function onRequest, attempt to email instead", e);
			// 	exportResults(context);
			// }
			
		}
		
	}

	function exportResults(context, decodedParams)
	{
		var mrTask = task.create({
			taskType: task.TaskType.MAP_REDUCE,
			scriptId: "customscript_cos_mr_cnsmptndmndrprt",
			params: {
			}
		});

		var mrParams = decodedParams;
		mrParams.savedSearchIds = [runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s1'}), runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s2'})];
		log.debug("mrParams from SL call", mrParams);
		mrTask.params = {
			'custscript_cos_mr_cdr_params': JSON.stringify(mrParams)
		};

		var mrTaskId = mrTask.submit();
		log.debug("mrTaskId", mrTaskId);
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


	var itemIdsFromTransactions = [];

	/**
	 * 
	 */
	function getListResultsObj(context, decodedParams)
	{
		
		log.debug("decodedParams", decodedParams)
		var dataFromSearch1 = getDataFromSearch1(context, decodedParams);
		var dataFromSearch2 = getDataFromSearch2(context, decodedParams);
		var combinedData = dataFromSearch1.concat(dataFromSearch2);
		
		log.debug("combinedData", combinedData);
		// combinedData = combinedData.splice(0,10000)
		
		var list = combinedData;
		var groupByIndividualItem = list.reduce(function(group, obj){

			var baseAttr = obj["Individual Item"].val;
			var attr = baseAttr;
			group[attr] = group[attr] || [];
			group[attr].push(obj);

			return group;
			},
		{});

		var startYear = 2019;
		var endYear = new Date().getFullYear();
		var startMonth = 0;
		var endMonth = 0;
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

		log.debug("groupByIndividualItem", groupByIndividualItem)
		for(var item in groupByIndividualItem)
		{
			// var item = groupByIndividualItem[item][0]["Individual Item"].val; //already grouped by item name, use key instead
			var itemInfo = {};
			itemInfo.grandTotal = 0;			
			// itemInfo.lastTranDate = groupByIndividualItem[item][0]["Last Transaction Date"].val; //each period will show its own max date, convert to date ms equivalent to make sure
			itemInfo.lastTranDate =  groupByIndividualItem[item].reduce((a, b) => {
				return new Date(a["Last Transaction Date"].val) > new Date(b["Last Transaction Date"].val) ? a : b;
			});
			// log.debug("itemInfo.lastTranDate", itemInfo.lastTranDate);
			itemInfo.lastTranDate = itemInfo.lastTranDate["Last Transaction Date"].val

			itemInfo.comittedQty = groupByIndividualItem[item][0]["Item Committed"].val || 0;
			itemInfo.onSoQty = groupByIndividualItem[item][0]["Item On SO"].val || 0;
			itemInfo.onHandQty = groupByIndividualItem[item][0]["Item On Hand"].val || 0;
			itemInfo.onPoQty = groupByIndividualItem[item][0]["Item On Order"].val || 0;

			var list = groupByIndividualItem[item] || [];
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
					itemInfo.grandTotal += Number(obj["Fulfilled"].val)

					return group;
					},
				{});

				groupByAccPeriod_year[year] = {periodList:groupByAccPeriod}
			}

			groupByIndividualItem[item] = {yearList : groupByAccPeriod_year, itemInfo : itemInfo};
		}

		log.debug("groupByIndividualItem", groupByIndividualItem);
		var objHtml = config.getResultsHtml(groupByIndividualItem, startYear, startMonth, endYear, endMonth);
		return {objHtml:objHtml};
	}

	function applyDtFormat(groupByIndividualItem)
	{
		var dtFormatted = [];
		var periodMonthOrder = ["jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
					
		for(var item in groupByIndividualItem)
		{
			
			for(var year in groupByIndividualItem[item].yearList)
			{
				var dtRow = ["", "", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
				var yearlyTotal = 0;
				for(var period in groupByIndividualItem[item].yearList[year].periodList)
				{
					
					var monthIndex = periodMonthOrder.indexOf(period.slice(0,3).toLowerCase())
					dtRow[0] = item;
					dtRow[1] = year;
					if(monthIndex != -1)
					{
						dtRow[monthIndex +4 ] = groupByIndividualItem[item].yearList[year].periodList[period].Fulfilled.val;
					}
					yearlyTotal += Number(groupByIndividualItem[item].yearList[year].periodList[period].Fulfilled.val)
				}
				dtRow[2] = yearlyTotal;
				dtFormatted.push(dtRow);
			}
		}
		log.debug("applyDtFormat dtFormatted", dtFormatted)
		return dtFormatted;
	}

	function getDataFromSearch1(context, decodedParams)
	{
		var searchId = runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s1'});
		log.debug("getDataFromSearch1 searchId", searchId);
		var dataFromSearch = [];
		log.debug("searchId", searchId);
		try
		{
			var base_searchObj = search.load({
				id : searchId
			});

			var newFilters = base_searchObj.filters;
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

			
			log.debug("getDataFromSearch1 newFilters", newFilters);
			var searchObj = search.create({
				type : base_searchObj.searchType,
				filters : newFilters,
				columns : base_searchObj.columns
			})

			log.debug("searchObj", searchObj);
			var sr = getResults(searchObj.run());
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
					dataFromSearch.push(sr_obj);

					if(itemIdsFromTransactions.indexOf(""))
					{
						itemIdsFromTransactions.push()
					}
					
				}
			}
		}
		catch(e)
		{
			log.error("ERROR in function getDataFromSearch1", e);
		}
		log.debug("getDataFromSearch1 dataFromSearch", dataFromSearch);
		return dataFromSearch;
	}

	function getDataFromSearch2(context, decodedParams)
	{
		var searchId = runtime.getCurrentScript().getParameter({name: 'custscript_cos_sl_itemshipoutreport3_s2'});
		log.debug("getDataFromSearch2 searchId", searchId);
		var dataFromSearch = [];
		try
		{
			var base_searchObj = search.load({
				id : searchId
			});

			var newFilters = base_searchObj.filters;
			if(decodedParams.param_dateFrom)
			{
				//because this is about itemfulfillment, the filters should apply to itemfulfillment
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

			log.debug("getDataFromSearch2 newFilters", newFilters);			
			var searchObj = search.create({
				type : base_searchObj.searchType,
				filters : newFilters,
				columns : base_searchObj.columns
			})
			var sr = getResults(searchObj.run());
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
					dataFromSearch.push(sr_obj);
				}
			}
		}
		catch(e)
		{
			log.error("ERROR in function getDataFromSearch2", e);
		}
		log.debug("getDataFromSearch2 dataFromSearch", dataFromSearch);
		return dataFromSearch;
	}

	function addCommas(num) {
		if(!num || num == 0 || num == "0" || num == "0.00" || (Number(num)==0))
			{
			return "0.00";
			}
		num = Number(num)
		num = num.toFixed(2);
		var str = num.toString().split('.');
		if (str[0].length >= 4) {
			//add comma every 3 digits befor decimal
			str[0] = str[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
		}
		/* Optional formating for decimal places
		if (str[1] && str[1].length >= 4) {
			//add space every 3 digits after decimal
			str[1] = str[1].replace(/(\d{3})/g, '$1 ');
		}*/
		return str.join('.');
	}

	function toNumber(val)
	{
		val = val + ""
		try
			{
			val = val ? Number(val.replace(/,/g, '')) : "";
			}
		catch(e)
			{
			log.error("ERROR in function toNumber", e.message);
			}
		return val
	}

	return {
		onRequest: onRequest 
	};
});
