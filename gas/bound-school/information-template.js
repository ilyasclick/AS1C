// function onOpen() {
//   var ui = SpreadsheetApp.getUi();
//   ui.createMenu('Документы')
//       .addItem('Создать Сведения', 'informationGenerate')
//       .addToUi();
// }
function informationGenerate() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getActiveRange();
  var numColumnsInSheet = sheet.getLastColumn();

  // Проверка количества выделенных столбцов
  var numColumnsInSelection = range.getNumColumns();
  if (numColumnsInSelection < numColumnsInSheet) {
    SpreadsheetApp.getUi().alert('Выделено меньше столбцов, чем в таблице.');
    return;
  }

  // Проверка выделения первой строки
  var firstRow = range.getRow();
  if (firstRow !== 1) {
    SpreadsheetApp.getUi().alert('Первая строка не выделена.');
    return;
  }

  // Получение данных из выделенного диапазона
  var data = range.getValues();
  var headers = sheet.getRange(1, 1, 1, numColumnsInSheet).getValues()[0];

  // Определение индекса столбца "Номер группы"
  var groupColumnIndex = headers.indexOf('Номер группы');
  Logger.log(`Номер группы столбца группы: ${groupColumnIndex}`)
  if (groupColumnIndex === -1) {
    SpreadsheetApp.getUi().alert('Столбец "Номер группы" не найден.');
    return;
  }
  groupColumnIndex += 1; // Индексы в getValues() начинаются с 0, а в getCell() с 1

  // Поиск номера группы из выделенного диапазона
  var groupNumber = '';
  for (var i = 1; i < data.length; i++) {
    if (!sheet.isRowHiddenByFilter(range.getRow() + i) && !sheet.isRowHiddenByUser(range.getRow() + i)) {
      groupNumber = data[i][groupColumnIndex - 1];
      break;
    }
  }
  if (!groupNumber) {
    SpreadsheetApp.getUi().alert('Номер группы не найден в выделенной области.');
    return;
  }
  Logger.log(`Номер группы ${groupNumber}`)
  // Создание копии шаблона
  var templateId = PropertiesService.getScriptProperties().getProperty('INFO_TEMPLATE_ID');
  var folderId = PropertiesService.getScriptProperties().getProperty('INFO_FOLDER_ID');
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
  var time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH-mm-ss');
  var copyName = 'Сведения #' + today + ' ' + time;
  var templateFile = DriveApp.getFileById(templateId);
  var folder = DriveApp.getFolderById(folderId);
  var newFile = templateFile.makeCopy(copyName, folder);

  // Формирование новой таблицы
  var newTable = [];

  for (var i = 0; i < data.length; i++) {
    var row = [];
    var currentRow = range.getRow() + i;

    // Проверка видимости строки
    if (sheet.isRowHiddenByFilter(currentRow) || sheet.isRowHiddenByUser(currentRow)) {
      continue;
    }

    row.push(i + 1);  // Порядковый номер

    // Анкетные данные
    var fullNameIndex = headers.indexOf('ФИО');
    var birthDateIndex = headers.indexOf('Дата рождения');
    var birthPlaceIndex = headers.indexOf('Место рождения');

    var fullName = data[i][fullNameIndex] ? String(data[i][fullNameIndex]).trim().toLowerCase() : '';
    var birthDate = data[i][birthDateIndex] ? String(data[i][birthDateIndex]).trim().toLowerCase() : '';
    var birthPlace = data[i][birthPlaceIndex] ? String(data[i][birthPlaceIndex]).trim().toLowerCase() : '';

    var personalData = fullName.split(' ').map(function(word) { return word.charAt(0).toUpperCase() + word.slice(1); }).join(' ') + '\n' +
                       birthDate.split(' ').map(function(word) { return word.charAt(0).toUpperCase() + word.slice(1); }).join(' ') + '\n' +
                       birthPlace.split(' ').map(function(word) { return word.charAt(0).toUpperCase() + word.slice(1); }).join(' ');
    row.push(personalData);

    // Документ удостоверяющий личность
    var passportIndex = headers.indexOf('Паспорт серия и номер');
    var issuedByIndex = headers.indexOf('Выдан (кем)');
    var issuedDateIndex = headers.indexOf('Выдан (дата)');

    var passportSeriesAndNumber = data[i][passportIndex] ? String(data[i][passportIndex]).trim() : '';
    var issuedBy = data[i][issuedByIndex] ? String(data[i][issuedByIndex]).trim() : '';
    var issuedDate = data[i][issuedDateIndex] ? String(data[i][issuedDateIndex]).trim() : '';

    var passportData = 'серия ' + passportSeriesAndNumber.slice(0, 4) + ' №' + passportSeriesAndNumber.slice(4) + '\n' +
                       issuedBy + '\n' + issuedDate;
    row.push(passportData);

    // Адрес регистрации (Пребывания)
    var addressIndex = headers.indexOf('Адрес регистрации (Пребывания)');
    var address = data[i][addressIndex] ? String(data[i][addressIndex]).trim() : '';
    row.push(address);

    // Медицинское заключение
    var medicalConclusionIndex = headers.indexOf('Медицинское заключение');
    var medicalConclusion = data[i][medicalConclusionIndex] ? String(data[i][medicalConclusionIndex]).trim() : '';
    row.push(medicalConclusion);

    // Водительское удостоверение и согласие на обработку персональных данных - пустые столбцы
    row.push('');  // Водительское удостоверение
    row.push('');  // Согласие на обработку персональных данных

    newTable.push(row);
  }

  // Вставка новой таблицы в документ
  var doc = DocumentApp.openById(newFile.getId());
  var body = doc.getBody();
  body.appendTable(newTable);

  doc.saveAndClose();
}
