function convToMicrosoft(fileId) {
  if (fileId == null) throw new Error("No file ID.");
  var file = DriveApp.getFileById(fileId);
  var mime = file.getMimeType();
  var format = "";
  var ext = "";
  switch (mime) {
    case "application/vnd.google-apps.document":
      format = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      ext = ".docx";
      break;
    case "application/vnd.google-apps.spreadsheet":
      format = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = ".xlsx";
      break;
    case "application/vnd.google-apps.presentation":
      format = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      ext = ".pptx";
      break;
    default:
      return null;
  }
  var url = "https://www.googleapis.com/drive/v3/files/" + fileId + "/export?mimeType=" + format;
  var blob = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true
  }).getBlob();
  var filename = file.getName();
  var id = DriveApp.createFile(blob).setName(~filename.indexOf(ext) ? filename : filename + ext).getId();
  return id;
};

function exportDocToPdf(docId,name) {
  var url = 'https://docs.google.com/document/d/' + docId + '/export?format=pdf';
  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  var blob = response.getBlob().setName(`${name}.pdf`);

  // Сохраняем PDF в папку на Google Drive
  var folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('CONVERT_OUTPUT_FOLDER_ID'));
  var file = folder.createFile(blob);
  return file.getId();
}
