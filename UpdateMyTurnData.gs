function updateMyTurnSheetsData() {
  const sessionIdCookie = getAuthenticatedSessionCookie();

  const config = getConfiguration();

  const locationId = getLocationId(sessionIdCookie);

  const overdueSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    "MyTurn Report: Loans, Overdue Only"
  );
  const overdueResponse = UrlFetchApp.fetch(
    "https://" +
      config["MyTurn Subdomain"] +
      ".myturn.com/library/orgLoan/exportLoans",
    {
      method: "post",
      payload: {
        dueBefore: "struct",
        // `toLocaleDateString` doesn't handle its `options` correctly in this old JS engine,
        // so brute-force formatting the date. We also can't control which time zone this
        // is run on, and old JS versions (like this one) don't support passing a time zone
        // into stringification, so we just have to set everything in UTC.
        dueBefore_date:
          (new Date().getUTCMonth() + 1).toString() +
          "/" +
          (new Date().getUTCDate() - 1).toString() +
          "/" +
          new Date().getUTCFullYear().toString(),
        dueBefore_time:
          new Date().getUTCHours() +
          ":" +
          new Date().getUTCMinutes().toString(),
        dueBefore_tz: "UTC",
        "location.id": locationId,
        out: "true",
        format: "csv",
      },
      headers: {
        Cookie: sessionIdCookie,
      },
    }
  );
  const overdueData = Utilities.parseCsv(overdueResponse.getContentText());
  overdueSheet.clear();
  overdueSheet
    .getRange(1, 1, overdueData.length, overdueData[0].length)
    .setValues(overdueData);

  const checkedOutSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    "MyTurn Report: Inventory, List Items, Checked Out"
  );
  const checkedOutResponse = UrlFetchApp.fetch(
    "https://" +
      config["MyTurn Subdomain"] +
      ".myturn.com/library/orgInventory/exportItemList",
    {
      method: "post",
      payload: {
        availability: "checked_out",
        format: "csv",
      },
      headers: {
        Cookie: sessionIdCookie,
      },
    }
  );
  const checkedOutData = Utilities.parseCsv(
    checkedOutResponse.getContentText()
  );
  checkedOutSheet.clear();
  checkedOutSheet
    .getRange(1, 1, checkedOutData.length, checkedOutData[0].length)
    .setValues(checkedOutData);
}

function getAuthenticatedSessionCookie() {
  const userProperties = PropertiesService.getUserProperties();
  // These secrets are stored as "user properties", and are therefore accessible
  // only to the Google Account who initially saved/populated them. (There's not
  // a dramatically better way to manage secrets on a shared Google Sheet/Apps
  // Script like this.)
  // https://developers.google.com/apps-script/guides/properties
  const username = userProperties.getProperty("myturn-username");
  const password = userProperties.getProperty("myturn-password");

  const config = getConfiguration();
  const loginResponse = UrlFetchApp.fetch(
    "https://" +
      config["MyTurn Subdomain"] +
      ".myturn.com/library/j_spring_security_check",
    {
      method: "post",
      payload: {
        j_username: username,
        j_password: password,
      },
      followRedirects: false,
    }
  );
  const sessionIdCookie = loginResponse
    .getAllHeaders()
    ["Set-Cookie"].split(";")
    .map(function (i) {
      return i.trim();
    })
    // Gosh, not having ES6 support is annoying; I miss `startsWith`
    .filter(function (i) {
      return i.slice(0, 11) === "JSESSIONID=";
    })[0];

  return sessionIdCookie;
}

function getLocationId(sessionIdCookie) {
  // Location ID is an internal MyTurn numeric identifier (potentially for tool
  // libraries with multiple physical locations?) required for some admin report
  // requests
  const config = getConfiguration();

  const res = UrlFetchApp.fetch(
    "https://" +
      config["MyTurn Subdomain"] +
      ".myturn.com/library/orgLoan/reportParameters",
    {
      method: "get",
      headers: {
        Cookie: sessionIdCookie,
      },
    }
  );
  // In an ideal world we'd use an HTML parsing library for this, but no
  // need to introduce that dependency for something this simple and static
  const locationId = res
    .getContentText()
    .match(/name="location\.id" value="(\d+)"/)[1];

  return locationId;
}
