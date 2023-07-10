/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */

/**
 * @Author Rodmar Dimasaca
 * @Email rod@consulesolutions.com
 * @Project Revival Parts
 * @Date May 29, 2023
 * @Filename COS_LIB_consumptionDemandReport.js
 */
define({
	
	reportForm: {
	clientScriptModulePath:
		'./COS_CS_consumptionDemandReport.js',
	title: 'Consumption Demand Report',
	fieldGroups: [
		{
			id: '_primary',
			label: 'Primary Information'
		}
	],
	tabs: [
		{
			id: '_resultstab_basichtml',
			label: 'HTML Results'
		},
	],
	fields: [
		{
			id: '_startdate',
			type: 'date',
			label: 'from date',
			isMandatory: true,
			container: '_primary',
			defaultvalue : new Date()
		},
		{
			id: '_enddate',
			type: 'date',
			label: 'to date',
			isMandatory: true,
			container: '_primary',
			defaultvalue : new Date()
		},
		{
			id: '_items',
			type: 'multiselect',
			label: 'Items',
			source: 'item',
			container: '_primary'
		},
		{
			id: '_resultsarea',
			type: 'inlinehtml',
			label: ' ',
			container: '_resultstab_basichtml'
		},
	],
	sublists: [],
	fieldOptions: [],
	standardButtons: [],
	customButtons: [
		{
			id: '_filter',
			label: 'Filter',
			functionName: 'filter'
		},
		{
			id: '_exporttoexcel',
			label: 'Export and Email',
			functionName: 'exporttoexcel'
		},
		// {
		// 	id: '_exporttoexcellocal',
		// 	label: 'Export(LOCAL)',
		// 	functionName: 'localexport'
		// }
	]
	},
	getCsvResults : getCsvResults,
	getResultsHeader : getResultsHeader,
	getResultsHtml : getResultsHtml,
});

var showYearlyTotal = true;
var csvDescendingOrder = true;
var showGrandTotal = true;
function getCsvResults(fileObj, groupByIndividualItem, startYear, startMonth, endYear, endMonth)
{
	log.debug("getCsvResults", {startYear, startMonth});
	var resultHtml = "";

	if(groupByIndividualItem)
	{

		var resultHtml_appendLine = "";
		resultHtml_appendLine+= "ITEM,";
		resultHtml += "ITEM,";
		var startYear_orig = startYear;
		var loopingYear = endYear ? endYear : new Date().getFullYear();
		while(loopingYear >= startYear)
		{
			// resultHtml += getCsvHeaders(loopingYear, startYear_orig, startMonth, endYear, endMonth);
			resultHtml_appendLine += getCsvHeaders_appendLine(loopingYear, startYear_orig, startMonth, endYear, endMonth);
			loopingYear--;
		}
		// resultHtml += "\n"
		if(showGrandTotal)
		{
			resultHtml_appendLine += /* "," + */ "Grandtotal";
		}
		
		fileObj.appendLine({
			value:resultHtml_appendLine
		})


		for(var item in groupByIndividualItem){
			var startYear_orig = startYear;
			var loopingYear = endYear ? endYear : new Date().getFullYear(); //fixed for case 7/1/2021 - 6/30/2022 where headers are longer than contents
			resultHtml += item + ",";
			var resultHtml_appendLine = `="${item}",`;
			
			while(loopingYear >= startYear)
			{
				if(groupByIndividualItem[item].yearList && groupByIndividualItem[item].yearList[loopingYear])
				{
					// resultHtml += getPeriodDataCsv(groupByIndividualItem[item].yearList[loopingYear], loopingYear, startYear, startMonth, endYear, endMonth);
					resultHtml_appendLine += getPeriodDataCsv_appendLine(groupByIndividualItem[item].yearList[loopingYear], loopingYear, startYear, startMonth, endYear, endMonth);
				}
				else
				{
					resultHtml_appendLine += getPeriodDataCsv_appendLine(null, loopingYear, startYear, startMonth, endYear, endMonth);
					// resultHtml += getPeriodDataCsv(null, loopingYear, startYear, startMonth, endYear, endMonth);
				}
				loopingYear--;
			}
			// resultHtml += "\n"
			if(showGrandTotal)
			{
				resultHtml_appendLine += /* "," + */ groupByIndividualItem[item].itemInfo.grandTotal;
			}
						
			fileObj.appendLine({
				value:resultHtml_appendLine
			})
			
		}

	}
	// return resultHtml;
	return fileObj;
}
function getPeriodDataCsv_appendLine(yearData, year, startYear, startMonth, endYear, endMonth)
{
	var html = "";
	// logger("getPeriodDataHtml yearData", yearData)
	var periodMonthOrder = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
	
	var tdList = [asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(),];
	
	if(year == startYear && startMonth)
	{
		periodMonthOrder = periodMonthOrder.slice(startMonth)
		tdList = tdList.slice(startMonth)
	}
	if(csvDescendingOrder)
	{
		periodMonthOrder = periodMonthOrder.reverse();
	}

	var yearlyTotal = 0;
	if(yearData && yearData.periodList)
	{
		for(var period in yearData.periodList)
		{
			var monthIndex = periodMonthOrder.indexOf(period.slice(0,3).toLowerCase())
			if(monthIndex != -1)
			{
				tdList[monthIndex] = asPeriodCsvTd(yearData.periodList[period].Fulfilled.val);
				yearlyTotal += Number(yearData.periodList[period].Fulfilled.val)
			}
		}
	}
	
	if(showYearlyTotal)
	{
		tdList.push(asPeriodCsvTd(yearlyTotal));
	}
	
	html += tdList.join(",");
	html += ",";

	return html;

}
function getPeriodDataCsv(yearData, year, startYear, startMonth, endYear, endMonth)
{
	var html = "";
	// logger("getPeriodDataHtml yearData", yearData)
	var periodMonthOrder = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
	
	var tdList = [asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(), asPeriodCsvTd(),];
	
	if(year == startYear && startMonth)
	{
		periodMonthOrder = periodMonthOrder.slice(startMonth)
		tdList = tdList.slice(startMonth)
	}
	if(csvDescendingOrder)
	{
		periodMonthOrder = periodMonthOrder.reverse();
	}

	var yearlyTotal = 0;
	if(yearData && yearData.periodList)
	{
		for(var period in yearData.periodList)
		{
			var monthIndex = periodMonthOrder.indexOf(period.slice(0,3).toLowerCase())
			if(monthIndex != -1)
			{
				tdList[monthIndex] = asPeriodCsvTd(yearData.periodList[period].Fulfilled.val);
				yearlyTotal += Number(yearData.periodList[period].Fulfilled.val)
			}
		}
	}
	
	if(showYearlyTotal)
	{
		tdList.push(asPeriodCsvTd(yearlyTotal));
	}
	
	html += tdList.join(",");
	html += ",";

	return html;

}

function asPeriodCsvTd(val)
{
	var html = "";
	html += val || 0;
	return html;
}

function getCsvHeaders(year, startYear, startMonth, endYear, endMonth)
{
	var html = "";
	var periodMonthOrder = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
	
	
	var tdList = [];

	if(year == startYear && startMonth)
	{
		periodMonthOrder = periodMonthOrder.slice(startMonth)
	}
	if(csvDescendingOrder)
	{
		periodMonthOrder = periodMonthOrder.reverse();
	}


	for(var a = 0 ; a < periodMonthOrder.length ; a++)
	{
		tdList.push(periodMonthOrder[a] + "_" + year)
	}
	
	if(showYearlyTotal)
	{
		tdList.push(asPeriodCsvTd("year" + year + " total"))
	}
	html += tdList.join(",");
	html += ",";

	return html;

}

function getCsvHeaders_appendLine(year, startYear, startMonth, endYear, endMonth)
{
	var html = "";
	var periodMonthOrder = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
	
	
	var tdList = [];

	if(year == startYear && startMonth)
	{
		periodMonthOrder = periodMonthOrder.slice(startMonth)
	}
	if(csvDescendingOrder)
	{
		periodMonthOrder = periodMonthOrder.reverse();
	}


	for(var a = 0 ; a < periodMonthOrder.length ; a++)
	{
		tdList.push(`"${periodMonthOrder[a] + "_" + year}"`)
	}
	
	if(showYearlyTotal)
	{
		tdList.push(asPeriodCsvTd("year" + year + " total"))
	}
	html += tdList.join(",");
	html += ",";

	return html;
}

function getResultsHeader(c){
	var resultHtml = "";
	resultHtml += `
	<style>
		.report{
			border : 1px solid black;
		}
		.report tr{
			border : 1px solid black;
		}

		.report {
			border-collapse: collapse;
		}



		.perioddata > tbody > tr > td
		{
			text-align : center;
			background-color : yellowgreen;
		}
		.perioddata > tbody > tr > th
		{
			text-align : center;
			background-color : lightgray
		}
		.perioddata {
			border-collapse: collapse;
			margin-bottom : 25px;
		}

		.fontSize15
		{
			font-size : 15px;
		}

		.stockdata > tbody > tr > td
		{
			text-align : center;
			background-color : yellowgreen;
		}
		.stockdata > tbody > tr > th
		{
			text-align : center;
			background-color : lightgray
		}
		.stockdata {
			border-collapse: collapse;
			margin-top : 25px;
			margin-bottom : 25px;
		}

		.__loader {
			border: 16px solid #f3f3f3;
			border-radius: 50%;
			border-top: 16px solid #d3d3d3;
			width: 120px;
			height: 120px;
			-webkit-animation: spin 2s linear infinite; /* Safari */
			animation: spin 2s linear infinite;
		  }
	
		  @-webkit-keyframes spin {
			0% {
			  -webkit-transform: rotate(0deg);
			}
			100% {
			  -webkit-transform: rotate(360deg);
			}
		  }
	
		  @keyframes spin {
			0% {
			  transform: rotate(0deg);
			}
			100% {
			  transform: rotate(360deg);
			}
		  }
	</style>
	`
	resultHtml += `
	<div id="__loader" style="display: none">
		<div style="margin: 0 auto;" class="__loader"></div>
	</div>`
	resultHtml += "<table class='report' width='100%'>";
	resultHtml += "<tr>";
	resultHtml += "<th>";
	resultHtml += "Individual Item";
	resultHtml += "</th>";
	resultHtml += "<th>";
	resultHtml += "Data";
	resultHtml += "</th>";
	resultHtml += "</tr>";

	resultHtml += "<tr>";
	resultHtml += "<td colspan='2' align='center' style='color:red'>";
	resultHtml += "Start By Selecting filters and clicking the Filter button.";
	resultHtml += "</thd>";
	resultHtml += "</tr>";

	resultHtml += "</table>";
	try
	{
		console.log("resultHtml", resultHtml)
	}
	catch(e)
	{
		log.debug("resultHtml", resultHtml)
	}
	return resultHtml;

}

function getResultsHtml(c, startYear, startMonth, endYear, endMonth)
{
	var resultHtml = "";
	resultHtml += `
	<style>
		.report{
			border : 1px solid black;
		}
		.report tr{
			border : 1px solid black;
		}

		.report {
			border-collapse: collapse;
		}



		.perioddata > tbody > tr > td
		{
			text-align : center;
			background-color : yellowgreen;
		}
		.perioddata > tbody > tr > th
		{
			text-align : center;
			background-color : lightgray
		}
		.perioddata {
			border-collapse: collapse;
			margin-bottom : 25px;
		}

		.stockdata > tbody > tr > td
		{
			text-align : center;
			background-color : yellowgreen;
		}
		.stockdata > tbody > tr > th
		{
			text-align : center;
			background-color : lightgray
		}
		.stockdata {
			border-collapse: collapse;
			margin-top : 25px;
			margin-bottom : 25px;
		}

		.fontSize15
		{
			font-size : 15px;
		}

		.__loader {
			border: 16px solid #f3f3f3;
			border-radius: 50%;
			border-top: 16px solid #d3d3d3;
			width: 120px;
			height: 120px;
			-webkit-animation: spin 2s linear infinite; /* Safari */
			animation: spin 2s linear infinite;
			}
	
			@-webkit-keyframes spin {
			0% {
				-webkit-transform: rotate(0deg);
			}
			100% {
				-webkit-transform: rotate(360deg);
			}
			}
	
			@keyframes spin {
			0% {
				transform: rotate(0deg);
			}
			100% {
				transform: rotate(360deg);
			}
			}
	</style>
	`
	resultHtml += `
	<div id="__loader" style="display: none">
		<div style="margin: 0 auto;" class="__loader"></div>
	</div>`
	resultHtml += "<table class='report fontSize15' width='100%'>";
	resultHtml += "<tr>";
	resultHtml += "<th>";
	resultHtml += "Individual Item";
	resultHtml += "</th>";
	resultHtml += "<th>";
	resultHtml += "Data";
	resultHtml += "</th>";
	resultHtml += "</tr>";
	if(c)
	{
		for(var item in c){

			// var startYear = 2019;
			// var currentYear = new Date().getFullYear();
			var loopingYear = endYear ? endYear : new Date().getFullYear();

			resultHtml += "<tr>";
			resultHtml += "<td width='20%' style='font-size:30px'>";
			resultHtml += item;
			resultHtml += "</td>";

			
			resultHtml += "<td>";

			resultHtml += "<table class='stockdata' width='50%'>";
			resultHtml += "<tr>";
			
			resultHtml += "<th>";
			resultHtml += "LAST TRANSACTION DATE";
			resultHtml += "</th>";
			
			resultHtml += "<th>";
			resultHtml += "ON HAND QTY";
			resultHtml += "</th>";
			
			resultHtml += "<th>";
			resultHtml += "COMMITED QTY";
			resultHtml += "</th>";
			
			resultHtml += "<th>";
			resultHtml += "ON SO";
			resultHtml += "</th>";
			
			resultHtml += "<th>";
			resultHtml += "ON PO";
			resultHtml += "</th>";
			
			resultHtml += "<th text-align='right'>";
			resultHtml += "GRAND TOTAL";
			resultHtml += "</th>";

			resultHtml += "</tr>";


			resultHtml += "<tr>";
			
			resultHtml += "<td>";
			resultHtml += c[item].itemInfo ? c[item].itemInfo.lastTranDate : "";
			resultHtml += "</td>";
			
			resultHtml += "<td>";
			resultHtml += c[item].itemInfo ? c[item].itemInfo.onHandQty : "";
			resultHtml += "</td>";
			
			resultHtml += "<td>";
			resultHtml += c[item].itemInfo ? c[item].itemInfo.comittedQty : "";
			resultHtml += "</td>";
			
			resultHtml += "<td>";
			resultHtml += c[item].itemInfo ? c[item].itemInfo.onSoQty : "";
			resultHtml += "</td>";
			
			resultHtml += "<td>";
			resultHtml += c[item].itemInfo ? c[item].itemInfo.onPoQty : "";
			resultHtml += "</td>";
			
			resultHtml += "<td>";
			resultHtml += c[item].itemInfo ? c[item].itemInfo.grandTotal : "";
			resultHtml += "</td>";

			resultHtml += "</tr>";

			resultHtml += "</table>";
			
			resultHtml += "<table class='yeardata' width='100%'>";

			while(loopingYear >= startYear)
			{
				resultHtml += "<tr>";
				resultHtml += "<td align='center'>";
				if(c[item].yearList && c[item].yearList[loopingYear])
				{
					resultHtml += "<b>";
					resultHtml += loopingYear;
					resultHtml += "</b>";
					resultHtml += getPeriodDataHtml(c[item].yearList[loopingYear], loopingYear);
				}
				else
				{
					resultHtml += "<b>";
					resultHtml += loopingYear;
					resultHtml += "</b>";
					resultHtml += getPeriodDataHtml(null, loopingYear);
					// resultHtml += "<br/> NO DATA";
				}
				loopingYear--;
				
				resultHtml += "</td>";
				resultHtml += "</tr>";
			}

			resultHtml += "</table>";


			resultHtml += "</tr>";
		}
	}

	resultHtml += "</table>";
	try
	{
		console.log("resultHtml", resultHtml)
	}
	catch(e)
	{
		log.debug("resultHtml", resultHtml)
	}
	return resultHtml;

}

function getPeriodDataHtml(yearData, year)
{
	
	// logger("getPeriodDataHtml yearData", yearData)
	var periodMonthOrder = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "total"];
	var tdHeaderList = [];
	var tdList = [asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(), asPeriodTd(),];
	var html = "<table class='perioddata' width='100%'><tr>";
  
	periodMonthOrder.forEach(function(month){
	  	tdHeaderList.push(asPeriodTh(month.toUpperCase() + " " + year));
	})
  
	html += tdHeaderList.join("");
  
	html += "</tr>"
	
  
	var yearlyTotal = 0;
	if(yearData && yearData.periodList)
	{
		for(var period in yearData.periodList)
		{
			var monthIndex = periodMonthOrder.indexOf(period.slice(0,3).toLowerCase())
			if(monthIndex != -1)
			{
				tdList[monthIndex] = asPeriodTd(yearData.periodList[period].Fulfilled.val);
				yearlyTotal += Number(yearData.periodList[period].Fulfilled.val)
			}
		}
	}
	
	tdList[13] = asPeriodTd(yearlyTotal)
	html += "<tr>"
	html += tdList.join("");
	html += "</tr></table>";
  
	// logger("getPeriodDataHtml html", html)
	return html;
  
}

function logger(title, val)
{
  	try
    {
      console.log(title, val)
    }
    catch(e)
    {
      log.debug(title, val)
    }
}

function asPeriodTd(val)
{
	var html = "<td>";
	html += val || 0;
	html += "</td>";
	return html;
}

function asPeriodTh(val)
{
	var html = "<th>";
	html += val || 0;
	html += "</th>";
	return html;
}
