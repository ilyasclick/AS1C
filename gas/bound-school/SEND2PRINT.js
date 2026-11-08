function sendPDF(pdfId) {
  var pdfUrl = "https://docs.google.com/document/d/" + pdfId + "/export?format=pdf";
  var token = PropertiesService.getScriptProperties().getProperty('PRINT_SERVER_TOKEN');

  // Получаем PDF из Google Docs
  var pdf = UrlFetchApp.fetch(pdfUrl, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }
  }).getBlob();

  // Отправляем PDF на сервер
  UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty('PRINT_SERVER_URL'), {
    method: "post",
    contentType: "application/pdf",
    headers: { Authorization: "Bearer " + token },
    payload: pdf.getBytes()
  });
}
