var ssID = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
var surveyID = PropertiesService.getScriptProperties().getProperty('SURVEY_TEMPLATE_ID');
var contractID = PropertiesService.getScriptProperties().getProperty('CONTRACT_TEMPLATE_ID');
var folderID = PropertiesService.getScriptProperties().getProperty('OUTPUT_FOLDER_ID');
var mainFolder = PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID');

var cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ']
