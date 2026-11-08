//Прописью

function num_letters(k, d) {  // целое число прописью, это основа
  var i = '', e = [
    ['', 'тысяч', 'миллион', 'миллиард', 'триллион', 'квадриллион', 'квинтиллион', 'секстиллион', 'септиллион', 'октиллион', 'нониллион', 'дециллион'],
    ['а', 'и', ''],
    ['', 'а', 'ов']
  ];
  if (k == '' || k == '0') return ' ноль'; // 0
  k = k.split(/(?=(?:\d{3})+$)/);  // разбить число в массив с трёхзначными числами
  if (k[0].length == 1) k[0] = '00' + k[0];
  if (k[0].length == 2) k[0] = '0' + k[0];
  for (var j = (k.length - 1); j >= 0; j--) {  // соединить трёхзначные числа в одно число, добавив названия разрядов с окончаниями
    if (k[j] != '000') {
      i = (((d && j == (k.length - 1)) || j == (k.length - 2)) && (k[j][2] == '1' || k[j][2] == '2') ? t(k[j], 1) : t(k[j])) + declOfNum(k[j], e[0][k.length - 1 - j], (j == (k.length - 2) ? e[1] : e[2])) + i;
    }
  }
  function t(k, d) {  // преобразовать трёхзначные числа
    var e = [
      ['', ' один', ' два', ' три', ' четыре', ' пять', ' шесть', ' семь', ' восемь', ' девять'],
      [' десять', ' одиннадцать', ' двенадцать', ' тринадцать', ' четырнадцать', ' пятнадцать', ' шестнадцать', ' семнадцать', ' восемнадцать', ' девятнадцать'],
      ['', '', ' двадцать', ' тридцать', ' сорок', ' пятьдесят', ' шестьдесят', ' семьдесят', ' восемьдесят', ' девяносто'],
      ['', ' сто', ' двести', ' триста', ' четыреста', ' пятьсот', ' шестьсот', ' семьсот', ' восемьсот', ' девятьсот'],
      ['', ' одна', ' две']
    ];
    return e[3][k[0]] + (k[1] == 1 ? e[1][k[2]] : e[2][k[1]] + (d ? e[4][k[2]] : e[0][k[2]]));
  }
  return i;
}
function declOfNum(n, t, o) {  // склонение именительных рядом с числительным: число (typeof = string), корень (не пустой), окончание
  var k = [2, 0, 1, 1, 1, 2, 2, 2, 2, 2];
  return (t == '' ? '' : ' ' + t + (n[n.length - 2] == "1" ? o[2] : o[k[n[n.length - 1]]]));
}
function razUp(e) {  // сделать первую букву заглавной и убрать лишний первый пробел
  return e[1].toUpperCase() + e.substring(2);
}
function sum_letters(a) {
  a = Number(a).toFixed(2).split('.');  // округлить до сотых и сделать массив двух чисел: до точки и после неё
  return razUp(num_letters(a[0]) + declOfNum(a[0], 'рубл', ['ь', 'я', 'ей']) + ' ' + a[1] + declOfNum(a[1], 'копе', ['йка', 'йки', 'ек']));
}

//Дата и время
function timestamp() {
  let monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня','июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  let d = new Date();
  //Logger.log(`${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} г.`)
  d = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} г.`
  return d;
}
function datestamp() {
  //«_____» ___________ 20__ г.
  let monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня','июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  let d = new Date();
  d = `«${d.getDate()}» ${monthNames[d.getMonth()]} ${d.getFullYear()} г.`
  //Logger.log(d)
  return d;
}

//Папки
function makeFolder(e) {
  var name = `${e.namedValues['Фамилия']} ${e.namedValues['Имя']} ${e.namedValues['Паспорт серия и номер']}`
  var surveyFolder = DriveApp.getFolderById(mainFolder).getFoldersByName('Анкеты').hasNext() && DriveApp.getFolderById(mainFolder).getFoldersByName('Анкеты').next() || DriveApp.getFolderById(mainFolder).createFolder('Анкеты')
  var groupFolder = e.namedValues['Номер группы'][0] ? surveyFolder.getFoldersByName(e.namedValues['Номер группы'][0]).hasNext() && surveyFolder.getFoldersByName(e.namedValues['Номер группы'][0]).next() || surveyFolder.createFolder(e.namedValues['Номер группы'][0]) : surveyFolder
  var personalFolder = groupFolder.getFoldersByName(name).hasNext() && groupFolder.getFoldersByName(name).next() || groupFolder.createFolder(name)
  return personalFolder

}
