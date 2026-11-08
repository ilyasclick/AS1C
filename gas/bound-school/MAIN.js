function printFolder() {
  return DriveApp.getFolderById(mainFolder).getFoldersByName('print').hasNext() && DriveApp.getFolderById(mainFolder).getFoldersByName('print').next() || DriveApp.getFolderById(mainFolder).createFolder('print')
}

function printFolderTest() {
  return DriveApp.getFolderById(mainFolder).getFoldersByName('printTest').hasNext() && DriveApp.getFolderById(mainFolder).getFoldersByName('printTest').next() || DriveApp.getFolderById(mainFolder).createFolder('printTest')
}

function setPrices() {
  var ss = ss2obj(ssID);
  var sheet = ss.sheets['Анкеты'];
  var prices = ss.sheets['Цены'];
  var priceColIndex = sheet.h('Общая сумма договора');
  var handPriceColIndex = sheet.h('Ручной ввод стоимости');
  var transmissionColIndex = sheet.h('Тип передачи');
  var minimaxiColIndex = sheet.h('Тип занятий');
  var discountColIndex = sheet.h('Скидки');

  // Получаем текущие значения в столбце "Общая сумма договора"
  var currentValues = sheet.getRange(2, priceColIndex + 1, sheet.rows.length, 1).getValues();

  var values = sheet.rows.map((row, i) => {
    // Проверка: если значение уже есть, не изменяем
    if (currentValues[i][0] !== '' && currentValues[i][0] !== null) {
      return [currentValues[i][0]];
    }

    var price;
    var handPrice = row[handPriceColIndex];
    var transmission = row[transmissionColIndex];
    var minimaxi = row[minimaxiColIndex];
    var discountRaw = row[discountColIndex];
    var discount = discountRaw ? (discountRaw.match(/(\d+)/g) ? parseInt(discountRaw.match(/(\d+)/g)[0]) : 0) : 0;

    if (handPrice) {
      price = `=${cols[handPriceColIndex]}${i + 2}`; // формула
    } else {
      if (minimaxi && transmission) {
        var matched = prices.rows.filter(r => r[0] == minimaxi && r[1] == transmission);
        if (matched.length > 0) {
          price = matched[0][2] - discount;
        } else {
          price = 'Не найдена цена';
        }
      } else {
        price = !minimaxi ? 'Не выбран тип программы' : 'Не выбран тип передачи';
      }
    }

    return [price];
  });

  // Записываем результат
  sheet.getRange(2, priceColIndex + 1, values.length, 1).setValues(values);
}

function formSubmit(e) {
  e.namedValues['Дата начала обучения'][0] =
    e.namedValues['Дата начала обучения'][0].replace(/\d{4}$/, '2026');
  Logger.log(e.namedValues)
  Logger.log(e.range)
  Logger.log(e.values)
  e.folder = makeFolder(e)
  var survey = changeSurvey(e);
  sendPDF(survey.getId())
  var contract = changeContract(e);
  sendPDF(contract.getId())
  sendPDF(contract.getId())


  var surveyDocx = convToMicrosoft(survey.getId())
  var contractDocx = convToMicrosoft(contract.getId())
  // exportDocToPdf(survey.getId(),`${survey.getName()}.pdf`)
  // exportDocToPdf(contract.getId(),`${contract.getName()}.pdf`)
  DriveApp.getFileById(surveyDocx).moveTo(printFolder())
  DriveApp.getFileById(contractDocx).moveTo(printFolder()).makeCopy(`${contract.getName()}-копия.docx`, printFolder())

  var ss = ss2obj(ssID)
  var resp = {}
  resp = ss.sheets['Анкеты']
  resp.h = function (value) { return this.headers.indexOf(value) }
  resp.last = resp.getDataRange().getLastRow()
  Logger.log(contract.price)
  resp.getRange(resp.last, resp.h('Общая сумма договора') + 1).setValue(contract.price)
  contract.balance = `=if(ISNUMBER(${cols[resp.h('Общая сумма договора')]}${resp.last});${cols[resp.h('Общая сумма договора')]}${resp.last}-sum(${cols[resp.h('Сумма взноса')]}${resp.last};${cols[resp.h('Сумма взноса 2')]}${resp.last};${cols[resp.h('Сумма взноса 3')]}${resp.last});${cols[resp.h('Общая сумма договора')]}${resp.last})`
  resp.getRange(resp.last, resp.h('Осталось внести') + 1).setValue(contract.balance)

  if (e.namedValues['Сумма взноса'][0]) { resp.getRange(resp.last, resp.h('Дата взноса 1') + 1).setValue(e.namedValues['Отметка времени'][0].split(' ')[0]) }
}

function changeSurvey(e) {
  var fileName = `Анкета ${e.namedValues['Фамилия'][0]} ${e.namedValues['Имя'][0]} ${e.namedValues['Паспорт серия и номер'][0]}`
  var survey = DriveApp.getFileById(surveyID).makeCopy(fileName, e.folder)

  var body = DocumentApp.openById(survey.getId()).getBody();
  body.replaceText('#Фамилия#', e.namedValues['Фамилия'][0] || '_______');
  body.replaceText('#Имя#', e.namedValues['Имя'][0] || '_______');
  body.replaceText('#Отчество#', e.namedValues['Отчество'][0] || '_______');
  body.replaceText('#ДатаРождения#', e.namedValues['Дата рождения'][0] || '_______');
  body.replaceText('#МестоРождения#', e.namedValues['Место рождения'][0] || '_______');
  //body.replaceText('#Образование#', e.namedValues['Образование'][0] || '_______');
  body.replaceText('#ДомашнийАдрес#', e.namedValues['Домашний адрес'][0] || '_______');
  body.replaceText('#ДомашнийТелефон#', e.namedValues['Телефон контактный'][0] || '_______');
  //body.replaceText('#МестоРаботы#', e.namedValues['Место работы'][0] || '_______');
  //body.replaceText('#РабочийТелефон#', e.namedValues['Телефон рабочий'][0] || '_______');
  //body.replaceText('#Должность#', e.namedValues['Занимаемая должность'][0] || '_______');
  body.replaceText('#ПаспортНомер#', e.namedValues['Паспорт серия и номер'][0] || '_______');
  body.replaceText('#ПаспортДата#', e.namedValues['Выдан (дата)'][0] || '_______');
  body.replaceText('#ПаспортКем#', e.namedValues['Выдан (кем)'][0] || '_______');
  //#НомерГруппы#, #КПП#, #МаксиМини#, #ВремяСуток#
  body.replaceText('#НомерГруппы#', e.namedValues['Номер группы'][0] || '_______');
  body.replaceText('#КПП#', e.namedValues['Тип передачи'][0] || '_______');
  body.replaceText('#МаксиМини#', e.namedValues['Тип занятий'][0] || '_______');
  body.replaceText('#ВремяЗанятий#', e.namedValues['Время занятий'][0] || '_______');
  body.replaceText('#Скидка#', e.namedValues['Скидка'][0] || '_______');
  body.replaceText('__ __________ 20__ г.', timestamp());

  body.replaceText('#М#', e.namedValues['Тип передачи'][0] == 'Механика' ? 'V' : '');
  body.replaceText('#A#', e.namedValues['Тип передачи'][0] == 'Автомат' ? 'V' : '');
  body.replaceText('#Мини#', e.namedValues['Тип занятий'][0] == 'Мини' ? 'V' : '');
  body.replaceText('#Макси#', e.namedValues['Тип занятий'][0] == 'Макси' ? 'V' : '');
  body.replaceText('#Утро#', e.namedValues['Время занятий'][0] == 'Утро' ? 'V' : '');
  body.replaceText('#Веч#', e.namedValues['Время занятий'][0] == 'Вечер' ? 'V' : '');
  body.replaceText('#Вых#', e.namedValues['Время занятий'][0] == 'Выходные' ? 'V' : '');
  body.replaceText('#Онл#', e.namedValues['Время занятий'][0] == 'Онлайн' ? 'V' : '');
  body.replaceText('#СуммаВзноса#', e.namedValues['Сумма взноса'][0] ? `${e.namedValues['Сумма взноса'][0]} р.` : '');

  var price
  if (e.namedValues['Ручной ввод стоимости'][0]) {
    price = e.namedValues['Ручной ввод стоимости'][0]
    price = `${price} (${sum_letters(price)})`
  }
  else {
    var prices = SpreadsheetApp.openById(ssID).getSheetByName('Цены').getDataRange().getValues()
    if (e.namedValues['Тип занятий'][0]) {
      price = prices.filter(row => row[0] == e.namedValues['Тип занятий']).filter(x => x[1] == e.namedValues['Тип передачи']).map(x => x[2])[0]
      var discont
      var disconts = SpreadsheetApp.openById(ssID).getSheetByName('Скидки').getDataRange().getValues()

      //discont = e.namedValues['Скидка'][0] ? disconts.filter(row => row[0] == e.namedValues['Скидка']).map(x => x[1])[0] : 0
      discont = e.namedValues['Скидка'][0] ? (e.namedValues['Скидка'][0].match(/(\d+)/g) ? e.namedValues['Скидка'][0].match(/(\d+)/g)[0] : 0) : 0
      price = price - discont
      //Logger.log(price)
      price = `${price} (${sum_letters(price)})`
    }
    else{
      price = '____'
    }


  }

  body.replaceText('#Стоимость#', price);

  DocumentApp.openById(survey.getId()).saveAndClose();

  //DocumentApp.openById(survey.getId()).getAs()
  return survey
}

function changeContract(e) {
  //Logger.log(e.namedValues)
  var fileName = `Договор ${e.namedValues['Фамилия']} ${e.namedValues['Имя']} ${e.namedValues['Паспорт серия и номер']}`
  var contract = DriveApp.getFileById(contractID).makeCopy(fileName, e.folder)

  var body = DocumentApp.openById(contract.getId()).getBody();
  body.replaceText('#Фамилия#', e.namedValues['Фамилия'][0] || '_______');
  body.replaceText('#Имя#', e.namedValues['Имя'][0] || '_______');
  body.replaceText('#Отчество#', e.namedValues['Отчество'][0] || '_______');
  body.replaceText('#ДатаРождения#', e.namedValues['Дата рождения'][0] || '_______');
  body.replaceText('#МестоРождения#', e.namedValues['Место рождения'][0] || '_______');
  //body.replaceText('#Образование#', e.namedValues['Образование'][0] || '_______');
  body.replaceText('#ДомашнийАдрес#', e.namedValues['Домашний адрес'][0] || '_______');
  body.replaceText('#ДомашнийТелефон#', e.namedValues['Телефон контактный'][0] || '_______');
  //body.replaceText('#МестоРаботы#', e.namedValues['Место работы'][0] || '_______');
  //body.replaceText('#РабочийТелефон#', e.namedValues['Телефон рабочий'][0] || '_______');
  //body.replaceText('#Должность#', e.namedValues['Занимаемая должность'][0] || '_______');
  body.replaceText('#ПаспортНомер#', e.namedValues['Паспорт серия и номер'][0] || '_______');
  body.replaceText('#ПаспортДата#', e.namedValues['Выдан (дата)'][0] || '_______');
  body.replaceText('#ПаспортКем#', e.namedValues['Выдан (кем)'][0] || '_______');
  body.replaceText('«_____» ___________ 20__ г.', datestamp());

  body.replaceText('#НомерГруппы#', e.namedValues['Номер группы'][0] || '_______');
  body.replaceText('#КПП#', e.namedValues['Тип передачи'][0] || '_______');
  body.replaceText('#МаксиМини#', e.namedValues['Тип занятий'][0] || '_______');
  body.replaceText('#ВремяЗанятий#', e.namedValues['Время занятий'][0] || '_______');
  body.replaceText('#КИмя#', `${e.namedValues['Имя'][0][0]}.` || '');
  body.replaceText('#КОтчество#', e.namedValues['Отчество']&&`${e.namedValues['Отчество'][0][0]}.` || '');

  body.replaceText('%Фамилия%', e.namedValues['Фамилия представителя'][0] || '_______');
  body.replaceText('%Имя%', e.namedValues['Имя представителя'][0] || '_______');
  body.replaceText('%Отчество%', e.namedValues['Отчество представителя'][0] || '_______');
  body.replaceText('%ПаспортНомер%', e.namedValues['Паспорт серия и номер представителя'][0] || '_______');
  body.replaceText('%ПаспортДата%', e.namedValues['Паспорт представителя выдан (дата)'][0] || '_______');
  body.replaceText('%ПаспортКем%', e.namedValues['Паспорт представителя выдан (кем)'][0] || '_______');
  body.replaceText('%Телефон%', e.namedValues['Телефон представителя'][0] || '_______');
  body.replaceText('%КИмя%', `${e.namedValues['Имя представителя'][0][0] || ''}`);
  body.replaceText('%КОтчество%', `${e.namedValues['Отчество представителя'][0][0] || ''}`);

  body.replaceText('«______» __________________ 20__ г.', e.namedValues['Дата начала обучения'][0] || '«______» __________________ 20__ г.');




  var price
  var priceNum
  if (e.namedValues['Ручной ввод стоимости'][0]) {
    price = e.namedValues['Ручной ввод стоимости'][0]
    priceNum = price
    price = `${price} (${sum_letters(price)})`
  }
  else {
    var prices = SpreadsheetApp.openById(ssID).getSheetByName('Цены').getDataRange().getValues()
    if (e.namedValues['Тип занятий'][0]) {
      price = prices.filter(row => row[0] == e.namedValues['Тип занятий']).filter(x => x[1] == e.namedValues['Тип передачи']).map(x => x[2])[0]
      var discont
      var disconts = SpreadsheetApp.openById(ssID).getSheetByName('Скидки').getDataRange().getValues()

      //discont = e.namedValues['Скидка'][0] ? disconts.filter(row => row[0] == e.namedValues['Скидка']).map(x => x[1])[0] : 0
      discont = e.namedValues['Скидка'][0] ? (e.namedValues['Скидка'][0].match(/(\d+)/g) ? e.namedValues['Скидка'][0].match(/(\d+)/g)[0] : 0) : 0
      price = price - discont
      priceNum = price
      //Logger.log(price)
      price = `${price} (${sum_letters(price)})`
    }
    else{
      price = '____'
      priceNum = '___'
    }
  }

  body.replaceText('#Стоимость#', price);
  DocumentApp.openById(contract.getId()).saveAndClose();
  //DriveApp.getFileById(contract.getId()).makeCopy().moveTo()
  contract.price = priceNum
  return contract
}

// function onOpen(ss) {
//   var ui = SpreadsheetApp.getUi();
//   ui.createMenu('Отчеты')
//     .addItem('Обновить платежи', 'payments')
//     //.addItem('Очистка листов', 'clearSheets')
//     //.addSeparator()
//     //.addSubMenu(ui.createMenu('Sub-menu')
//     //.addItem('Second item', 'menuItem2'))
//     .addToUi();
// }

function payments() {
  var ss = ss2obj(ssID)
  ss.sheets['Платежи'] = ss.getSheetByName('Платежи') || ss.insertSheet('Платежи')
  ss.sheets['Платежи'].rows = []
  ss.sheets['Платежи'].headers = ['Фамилия', 'Группа', 'Дата платежа', 'Сумма платежа', 'Тип оплаты', 'Номер платежа']
  ss.sheets['Платежи'].h = function (value) { return this.headers.indexOf(value) }
  ss.sheets['Платежи'].lastR = function () { return this.getLastRow() }



  ss.sheets['Анкеты'].rows.forEach(row => {
    var sheet = ss.sheets['Анкеты']
    var name = [row[sheet.h('Фамилия')], row[sheet.h('Имя')], row[sheet.h('Отчество')]].filter(x => x != '' || x).join(' ')
    var group = row[sheet.h('Номер группы')]
    //var paymentsHeaders = ['Дата взноса 1', 'Дата взноса 2', 'Дата взноса 3']
    //Сумма взноса 2	Тип Оплаты 2
    var day1 = row[sheet.h('Дата взноса 1')];
    var day2 = row[sheet.h('Дата взноса 2')];
    var day3 = row[sheet.h('Дата взноса 3')];
    var days = [day1, day2, day3];
    var pay1 = row[sheet.h('Сумма взноса')];
    var pay2 = row[sheet.h('Сумма взноса 2')];
    var pay3 = row[sheet.h('Сумма взноса 3')];
    var pays = [pay1, pay2, pay3];
    var type1 = row[sheet.h('Тип Оплаты 1')];
    var type2 = row[sheet.h('Тип Оплаты 2')];
    var type3 = row[sheet.h('Тип Оплаты 3')];
    var types = [type1, type2, type3];


    pays.filter(x => x != '' || x).forEach((payment, i) => { ss.sheets['Платежи'].rows.push([name, group, days[i], pays[i], types[i], i + 1]) })
    //ss.sheets['Платежи'].rows.push([name,group,pay1])
  })

  ss.sheets['Платежи'].getDataRange().clear()
  ss.sheets['Платежи'].getRange(1, 1, 1, ss.sheets['Платежи'].headers.length).setValues([ss.sheets['Платежи'].headers])
  ss.sheets['Платежи'].getRange(2, 1, ss.sheets['Платежи'].rows.length, ss.sheets['Платежи'].rows[0].length).setValues(ss.sheets['Платежи'].rows)
}
