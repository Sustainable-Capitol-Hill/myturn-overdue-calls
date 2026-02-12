var getConfiguration = function () {
  const configSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuration");

  const config = configSheet
    .getRange(1, 1, configSheet.getMaxRows(), 2)
    .getValues()
    .reduce(function (acc, row) {
      acc[row[0]] = row[1];
      return acc;
    }, {});

  // Watch out: Some of these values that _should_ be numbers may have been cast as strings
  return config;
};
