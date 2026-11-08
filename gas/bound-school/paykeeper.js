// function onOpen() {
//   var ui = SpreadsheetApp.getUi();
//   ui.createMenu('Paykeeper')
//       .addItem('Сканировать папку', 'scanFolder')
//       .addToUi();
// }

function scanFolder() {
  var folderId = PropertiesService.getScriptProperties().getProperty('PAYKEEPER_SCAN_FOLDER_ID');
  var archiveFolderName = 'Архив';

  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByType(MimeType.MICROSOFT_EXCEL);
  var archiveFolder = getOrCreateFolder(folder, archiveFolderName);

  while (files.hasNext()) {
    var file = files.next();
    var data = extractDataFromXlsx(file);
    // Process the data as needed, e.g., log it or save to a sheet
    Logger.log(data);
    processData(data)
    //add new list to spreadsheet with filename and wrtite processed data to it
    //file.moveTo(archiveFolder);
  }

  //SpreadsheetApp.getUi().alert('Сканирование завершено.');
}

function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

function extractDataFromXlsx(file) {
  var blob = file.getBlob();
  Logger.log(file.getName())
  var spreadsheet = SpreadsheetApp.openByUrl(Drive.Files.insert({
    title: file.getName(),
    mimeType: MimeType.GOOGLE_SHEETS
  }, blob).alternateLink);
  var sheet = spreadsheet.getSheets()[0];
  var range = sheet.getDataRange();
  var values = range.getValues();

  // Delete the temporary spreadsheet
  DriveApp.getFileById(spreadsheet.getId()).setTrashed(true);

  return values;
}

function processData(data) {
  // data is basic google spreadsheet array of rows and columns
  // First row is headers
  var headers = data[0];

  // Indices of required columns
  var orderNumberIndex = headers.indexOf("Номер заказа");
  var userIdIndex = headers.indexOf("ID пользователя");
  var paymentAmountIndex = headers.indexOf("Размер платежа");
  var statusIndex = headers.indexOf("Статус платежа");
  var phoneIndex = headers.indexOf("Телефон");

  // Check if all required headers are present
  if (orderNumberIndex === -1 || userIdIndex === -1 || paymentAmountIndex === -1 || statusIndex === -1 || phoneIndex === -1) {
    Logger.log("Required headers are missing in the data");
    return;
  }

  // Modify headers to include new columns if not already present
  var newHeaders = headers.slice(); // Copy existing headers
  if (!newHeaders.includes("Name")) {
    newHeaders.push("Name");
  }
  if (!newHeaders.includes("Group Number")) {
    newHeaders.push("Group Number");
  }
  if (!newHeaders.includes("Status")) {
    newHeaders.push("Status");
  }
  if (!newHeaders.includes("Payment Amount")) {
    newHeaders.push("Payment Amount");
  }

  // Update data array with new headers
  data[0] = newHeaders;

  // Process each row of data
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var groupNumber = row[orderNumberIndex];
    var userId = row[userIdIndex];
    var paymentAmount = row[paymentAmountIndex];
    var status = row[statusIndex];
    var phone = row[phoneIndex];

    // Check if payment status is "Совершён" (Completed)
    if (status === "Совершён") {
      var namelist = createNameList(groupNumber); // Assume createNameList(groupNumber) exists

      // Find the name corresponding to the userId in namelist
      var name = findNameInNameList(userId, namelist);

      // Prepare data to add to the original data array
      var found = [];
      if (name) {
        found = [name, groupNumber, status, paymentAmount];
      } else {
        // If name not found, add placeholders or handle accordingly
        found = [null, groupNumber, status, paymentAmount];
      }

      // Add found data to the corresponding row in original data
      data[i] = data[i].concat(found);
    }
  }

  // Return the updated data
  Logger.log(data)
  return data;
}

function findNameInNameList(userId, namelist) {
  // Attempt to find userId in namelist
  if (namelist.includes(userId)) {
    return userId;
  }

  // If direct match fails, try to find partial matches
  var userIdParts = userId.split(" ");
  for (var i = 0; i < userIdParts.length; i++) {
    for (var j = 0; j < namelist.length; j++) {
      if (namelist[j].includes(userIdParts[i])) {
        return namelist[j];
      }
    }
  }

  // Return null if no match is found
  return null;
}
