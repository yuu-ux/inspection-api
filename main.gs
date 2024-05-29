function deleteTriggers() {
  const removeTriggers = ScriptApp.getProjectTriggers();
  if (removeTriggers.length > 19) {
    for (const removeTrigger of removeTriggers) {
      ScriptApp.deleteTrigger(removeTrigger);
    }
  }
}

function resetScriptProperties() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  console.log("スクリプトプロパティがリセットされました。");
}

function searchConsoleInspect() {
  let apiURL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
  let siteUrl = "/*サイトのプロパティを設定する*/";

  // 検査対象のURLの配列を定義してください
  let inspectUrls = [
  ];

  // 不動産売却DBシートを取得
  let date = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd');
  let spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName('不動産売却DB');

   // 前回の続きから処理を再開するためのインデックスを取得
  let startIndex = PropertiesService.getScriptProperties().getProperty('lastProcessedIndex') || 0;
  startIndex = parseInt(startIndex);

  // // ヘッダー行を追加
  // if (startIndex === 0) {
  //   let headers = ['inspectedUrl', 'verdict', 'lastCrawlTime', 'coverageState', 'crawledAs', 'googleCanonical', 'userCanonical', 'pageFetchState', 'robotsTxtState', 'indexingState', 'Date'];
  //   sheet.appendRow(headers);
  // }

  // 開始時間を記録
  let startTime = Date.now();

  // ループ制御変数を定義
  let i = startIndex;

  // 各URLに対してAPIリクエストを送信し、結果を書き込む
  while (i < inspectUrls.length) {
    let inspectUrl = inspectUrls[i];
    let payload = {
      'inspectionUrl': inspectUrl,
      'siteUrl': siteUrl,
      "languageCode": 'ja'
    };
    let options = {
      'myamethod': 'POST',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true,
      'headers': {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
      'contentType': 'application/json'
    };

    try {
      // APIリクエスト
      let response = UrlFetchApp.fetch(apiURL, options);
      let json = JSON.parse(response.getContentText());

      // レスポンスにinspectionResultが含まれている場合のみ処理を続行
      if (json.inspectionResult && json.inspectionResult.indexStatusResult) {
        let inspectionResult = json.inspectionResult;
        let indexStatusResult = inspectionResult.indexStatusResult;

        // データ行を追加
        let row = [
          inspectUrl,
          indexStatusResult.verdict,
          indexStatusResult.lastCrawlTime,
          indexStatusResult.coverageState,
          indexStatusResult.crawledAs,
          indexStatusResult.googleCanonical,
          indexStatusResult.userCanonical,
          indexStatusResult.pageFetchState,
          indexStatusResult.robotsTxtState,
          indexStatusResult.indexingState,
          date
        ];
        sheet.appendRow(row);
      } else {
        // エラー行を追加
        let errorRow = [inspectUrl, "結果が取得できませんでした。"];
        let appendResult = sheet.appendRow(errorRow);
        let lastRow = sheet.getLastRow(); // 最後に追加された行番号を取得
        sheet.getRange(`K${lastRow}`).setValue(date); // 最後に追加された行のK列に日付を設定
      }
    } catch (error) {
      // エラー行を追加
      let errorRow = [inspectUrl, `処理中にエラーが発生しました: ${error.message}`];
      let appendResult = sheet.appendRow(errorRow);
      let lastRow = sheet.getLastRow(); // 最後に追加された行番号を取得
      sheet.getRange(`K${lastRow}`).setValue(date); // 最後に追加された行のK列に日付を設定
    }

    // 5分経過したら処理を中断し、次の実行時に続きから再開する
    if (Date.now() - startTime > 5 * 60 * 1000) {
      i++;
      PropertiesService.getScriptProperties().setProperty('lastProcessedIndex', i.toString());
      deleteTriggers();

      // 1分後に処理を再開するためのトリガーを設定
      ScriptApp.newTrigger('searchConsoleInspect')
        .timeBased()
        .after(1 * 60 * 1000)
        .create();
      return;
    }
    i++;
  }

  // 最後まで処理が完了したらプロパティをクリアし、翌日の午前4時にトリガーを設定
  if (i === inspectUrls.length) {
  PropertiesService.getScriptProperties().deleteProperty('lastProcessedIndex');

  // 翌日の午前4時にトリガーを設定
  ScriptApp.newTrigger('searchConsoleInspect')
  .timeBased()
  .atHour(3)
  .everyDays(1)
  .create();

  return;
  }
}
