/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @Author Rodmar Dimasaca
 * @Email rod@consulesolutions.com
 * @Project Revival Parts
 * @Date May 29, 2023
 * @Filename COS_UE_consumptionDemandReport.js
 */

/**
 * Script Name          :   COS_UE_consumptionDemandReport
 * File Name            :   COS_UE_consumptionDemandReport.js
 * 
 * Description          :   
 * 
 * Dependencies         :   format--- <this File Name> <is used by/uses> <this Dependency>
 * Libraries            :   
 * 
 * Version              :   1.0.0 initial version
 * 
 * 
 * Notes                :   
 * 
 * TODOs                :   
 * 
 */
define(['N/ui/serverWidget', 'N/url'],
/**
 * @param {serverWidget} serverWidget
 * @param {url} url
 */
function(serverWidget, url) {
   
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
    
    return {
        beforeLoad: beforeLoad,
    };
    
});
