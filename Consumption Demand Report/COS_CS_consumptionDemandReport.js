/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

/**
 * @Author Rodmar Dimasaca
 * @Email rod@consulesolutions.com, rjdimasaca@gmail.com
 * @Project Revival Parts
 * @Date May 29, 2023
 * @Filename COS_CS_consumptionDemandReport.js
 */
define(['N/ui/message', 'N/ui/dialog', 'N/currentRecord', 'N/https', './RD_LIB_consumptionDemandReport.js'],
function(message, dialog, currentRecord, https, config){
    var functions = {};
    
    functions.pageInit = function(context) {
      
    };
    
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

    function showLoader()
    {
        var myMsg = message.create({
            title: "Sourcing Values", 
            message: "Please wait...", 
            type: message.Type.INFORMATION
        });
    
        // will disappear after 5s
        myMsg.show({
            duration: 3
        });
        return true;
    }

    functions.fieldChanged = function(scriptContext)
    {

    }

    function cleanRespBody(respBody)
    {
        var startCommentIndex = respBody.indexOf("<!--")
        return respBody.slice(0, startCommentIndex);
    }
  
    functions.localexport = function() {
        var textValues = ["000421", "Banana", "Orange"]; // Example text values

        // Create a new workbook
        var workbook = XLSX.utils.book_new();

        // Create a new worksheet
        var worksheet = XLSX.utils.aoa_to_sheet([["Text Values"]].concat(textValues.map(function(value) {
        return [value];
        })));

        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

        // Convert the workbook to an Excel file in binary format
        var excelFileBinary = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

        // Create a Blob from the binary data
        var blob = new Blob([excelFileBinary], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        // Save the file
        if (navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(blob, "text_values.xlsx");
        } else {
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "text_values.xlsx";
        link.click();
        }
    }
    /**
     * Requests results with filtering
     */
    functions.filter = function() {
        
        var uiURL = window.location.href;
        var form = currentRecord.get();
        var items = form.getValue({ fieldId: '_items' });
        items = items.join(",");
        var itemsText = form.getText({ fieldId: '_items' });
        itemsText = itemsText.join(",");
        var startDate = form.getText({ fieldId: '_startdate' });
        var endDate = form.getText({ fieldId: '_enddate' });
    
        console.log('data', {
            items: items,
            startDate: startDate,
            endDate: endDate,
        });
        if (!startDate || !endDate) {
            dialog.alert({
                title: 'Notice',
                message: 'Please specify filters for the mandatory fields'
            });
            return; // halt execution
        }
        
        jQuery('#__loader').fadeIn();
        var servicePath = window.location.pathname;
        var params = window.location.search;
        
        if (startDate){
            params += '&dateFrom=' + encodeURIComponent(startDate);
        }
        if (endDate){
            params += '&dateTo=' + encodeURIComponent(endDate);
        }
        if (items){
            params += '&items=' + encodeURIComponent(items);
        }
        if (itemsText){
            params += '&itemsText=' + encodeURIComponent(itemsText);
        }
    
        params += '&requestaction=getlist';
          
        var path = servicePath + params;
        console.log('service path', path);
        // execute a get request to the same service

        https.get.promise({
            url : path
        }).then(function(res){
            console.log("HTTPS instead of fetch resp.body", res.body);
            var respBodyClean = cleanRespBody(res.body);
            console.log("respBodyClean", respBodyClean);

            try{
                var res = JSON.parse(respBodyClean)
        
                console.log(202,res)
                if (res.success) {
                    var d = res.objHtml;
    
                    jQuery('#__loader').hide();
    
                    displayResults(d);
                }
            }
            catch(e)
            {
                jQuery('#__loader').hide();
                console.log("caught exception", e)
                // alert("The data may be too big, you can use the EXPORT feature instead.")
            }
            
        })
        .catch(function onRejected(reason) {
            console.log({
                title: 'Invalid Get Request: ',
                details: reason
            });
            jQuery('#__loader').hide();
            alert("The data may be too big, you can use the EXPORT feature instead.")
        });

        console.log('filtering results');
    
    }

    function displayResults(d)
    {
        console.log("displayResults d", d)
        // var mainForm = $("#main_form");
        // origHtml = mainForm.html();
        // mainForm.html(config.getResultsHtml(c))
        if(d)
        {
            jQuery("#_resultsarea_val").html(d)
            // return;
            // var newResultsHtml = config.getResultsHtml(c);
            // var form = currentRecord.get();
            // form.setValue({ fieldId: '_resultsarea' , value : d});
        }

        return;
    }

    functions.exporttoexcel = function() {
        var uiURL = window.location.href;
        var form = currentRecord.get();
        var items = form.getValue({ fieldId: '_items' });
        items = items.join(",");
        var itemsText = form.getText({ fieldId: '_items' });
        itemsText = itemsText.join(",");
        var startDate = form.getText({ fieldId: '_startdate' });
        var endDate = form.getText({ fieldId: '_enddate' });
    
        console.log('data', {
            items: items,
            startDate: startDate,
            endDate: endDate,
        });
        if (!startDate || !endDate) {
            dialog.alert({
                title: 'Notice',
                message: 'Please specify filters for the mandatory fields'
            });
            return; // halt execution
        }
        
        var servicePath = window.location.pathname;
        var params = window.location.search;

        
        if (startDate){
            params += '&dateFrom=' + encodeURIComponent(startDate);
        }
        if (endDate){
            params += '&dateTo=' + encodeURIComponent(endDate);
        }
        if (items){
            params += '&items=' + encodeURIComponent(items);
        }
        if (itemsText){
            params += '&itemsText=' + encodeURIComponent(itemsText);
        }
    
        params += '&requestaction=export&user='; //+ runtime.getCurrentUser().id;
        
        var path = servicePath + params;

        console.log("path", path);
        //POST more applicable?
        https.get({
            url : path
        })/* .then(function(res){
            
        })
        .catch(function onRejected(reason) {
            console.log({
                title: 'Invalid Get Request: ',
                details: reason
            });
        }); */

	    alert("Email will be sent based on the current filters.");
        console.log('export request submitted');
    };

    return functions;

});
