function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() === 'Платежи' && e.range.getColumn() === 2) {
    var row = e.range.getRow();
    var value = e.value;

    if (value === '') {
      clearDataValidationForRow(sheet, row);
    } else if (!isNaN(value)) {
      var groupNumber = parseInt(value, 10);
      var nameList = createNameList(groupNumber);
      setDataValidationForRowA(sheet, row, nameList);
    }

    // Always set data validation for columns C and E
    setDataValidationForRowC(sheet, row);
    setDataValidationForRowE(sheet, row);
  }
}

function createNameList(groupNumber) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Анкеты');
  var data = sheet.getDataRange().getValues();
  var nameList = [];

  for (var i = 1; i < data.length; i++) { // Starting from 1 to skip the header row
    if (data[i][7] == groupNumber) { // Column H is index 7 (0-based)
      var firstName = data[i][2] ? toTitleCase(data[i][2].toLowerCase()) : '';
      var middleName = data[i][3] ? toTitleCase(data[i][3].toLowerCase()) : '';
      var lastName = data[i][4] ? toTitleCase(data[i][4].toLowerCase()) : '';
      var fullName = firstName + ' ' + middleName + ' ' + lastName;
      fullName = fullName.trim(); // Remove any leading or trailing spaces
      if (fullName) {
        nameList.push(fullName);
      }
    }
  }
  return nameList;
}

function toTitleCase(str) {
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function setDataValidationForRowA(sheet, row, nameList) {
  var range = sheet.getRange(row, 1); // Column A is index 1
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(nameList, true)
    .build();
  range.setDataValidation(rule);
}

function setDataValidationForRowC(sheet, row) {
  var range = sheet.getRange(row, 3); // Column C is index 3
  var rule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .build();
  range.setDataValidation(rule);
}

function setDataValidationForRowE(sheet, row) {
  var range = sheet.getRange(row, 5); // Column E is index 5
  var allowedValues = ["QR-код", "Наличные", "Банк"];
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allowedValues, true)
    .build();
  range.setDataValidation(rule);
}

function clearDataValidationForRow(sheet, row) {
  var rangeA = sheet.getRange(row, 1); // Column A is index 1
  var rangeC = sheet.getRange(row, 3); // Column C is index 3
  var rangeE = sheet.getRange(row, 5); // Column E is index 5
  rangeA.clearDataValidations();
  rangeC.clearDataValidations();
  rangeE.clearDataValidations();
}
