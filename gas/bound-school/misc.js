function ss2obj(id) {
  var ss = SpreadsheetApp.openById(id)
  ss.sheets = {}
  ss.getSheets().forEach(sheet => {
    var sheetName = sheet.getName()
    if (sheetName != 'Log' && sheetName != 'Status' && sheet.getLastColumn() != 0) {
      ss.sheets[sheetName] = sheet
      ss.sheets[sheetName].rows = sheet.getDataRange().getValues()
      ss.sheets[sheetName].rows.shift()
      var a = sheet.getLastColumn()
      ss.sheets[sheetName].headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      ss.sheets[sheetName].h = function (value) { return this.headers.indexOf(value) }
      ss.sheets[sheetName].lastR = ss.sheets[sheetName].getLastRow()
    }
  })
  return ss
}
