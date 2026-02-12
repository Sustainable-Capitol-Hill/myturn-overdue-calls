// Note: have to use ES5(?) syntax/polyfills since we deactivated the V8 JavaScript engine for this project
// See discussion on https://stackoverflow.com/questions/60230776/were-sorry-a-server-error-occurred-while-reading-from-storage-error-code-perm

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Make Calls")
    .addItem("Initiate call", "initiateHigherValueCallDialog")
    .addItem("Initiate call for specific item", "initiateFilteredCallDialog")
    .addItem("Initiate call, including low-value items", "initiateCallDialog")
    .addToUi();
}

// prettier-ignore
var CALL_OUTCOME_CATEGORIES = {
  TALKED_WILL_RETURN: "🗣️ Talked to patron, and they plan to return the item(s)",
  TALKED_WONT_RETURN: "🗣️ Talked to patron, but they won't or can't return the item(s)",
  TALKED_DROPPED: "🗣️ Talked to patron, but they hung up on you or the call dropped",
  TALKED_NOT_CHECKED_OUT: "🗣️ Talked to patron, but they already returned (or never checked out) the item(s); please correct this in MyTurn!",
  VOICEMAIL_LEFT: "☎️ Successfully left a voicemail",
  VOICEMAIL_FULL: "📵 Voicemail full or not functioning",
  FAILED_DISCONNECTED: "📵 Phone number is disconnected or out of service",
  FAILED_WRONG_NUMBER: "📵 Phone number appears to be associated with a different person",
  FAILED_INVALID_NUMBER: "📵 Phone number is incomplete, invalid, or missing",
};

function getParentTaxonName(taxonName) {
  const ROOT_TAXON_ID = 1;

  // Not being able to use `let`s or `Array.find` in this JS engine is annoying
  var taxonParentId;
  var parentTaxon;
  MY_TURN_ITEM_TAXONOMY.forEach(function (taxon) {
    if (taxon.name === taxonName) {
      taxonParentId = taxon.parent;
    }
  });
  MY_TURN_ITEM_TAXONOMY.forEach(function (taxon) {
    if (taxon.id === taxonParentId) {
      parentTaxon = taxon;
    }
  });

  if (parentTaxon && parentTaxon.id !== ROOT_TAXON_ID) {
    return parentTaxon.name;
  } else {
    return null;
  }
}

function getRandomItemFromArray(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function parseRowsIntoObjects(headers, rows) {
  return rows.map(function (row) {
    const rowObject = {};

    row.map(function (value, index) {
      const header = headers[index];
      rowObject[header] = value;
    });

    return rowObject;
  });
}

function processCallForm(formObject) {
  insertCallsMadeRow(
    // This should be in the same time zone as the user's spreadsheet (so almost always Pacific Time)
    new Date().toLocaleDateString("en-US"),
    formObject.username,
    formObject.outcomeCategory,
    formObject.outcomeNotes
  );
}

function insertCallsMadeRow(date, username, outcomeCategory, outcomeNotes) {
  const callsSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log of Calls Made");
  const callsColumnCount = callsSheet.getMaxColumns();
  callsSheet.insertRowAfter(1);
  callsSheet
    .getRange(2, 1, 1, callsColumnCount)
    .setValues([[date, username, outcomeCategory, outcomeNotes]]);
}

function getAllOverdueUsers() {
  const usersToCallSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    "Users with Overdue Items"
  );
  const usersToCallColumnCount = usersToCallSheet.getMaxColumns();
  const usersToCallHeaders = usersToCallSheet
    .getRange(1, 1, 1, usersToCallColumnCount)
    .getValues()[0];
  const usersToCallRows = usersToCallSheet
    .getRange(2, 1, usersToCallSheet.getMaxRows() - 1, usersToCallColumnCount)
    .getValues()
    .filter(function (i) {
      return Boolean(i[0]);
    });
  const usersToCall = parseRowsIntoObjects(usersToCallHeaders, usersToCallRows);

  return usersToCall;
}

function initiateCallDialog(filters) {
  // Fetch some filters from the spreadsheet's configuration
  const config = getConfiguration();
  const minimumDaysOverdue =
    Number(config["Days Overdue Before First Call"]) || 60;
  const minimumDaysSinceLastCall =
    Number(config["Minimum Days Between Calls"]) || 14;

  // Set filter defaults
  const itemNameToSearch = filters && filters.itemNameToSearch;
  const onlyHigherValueItems =
    (filters && filters.onlyHigherValueItems) || false;

  const highValueTaxaSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      "Configuration: MyTurn High-Value Item Taxonomies"
    );
  const myTurnHighValueTaxa = highValueTaxaSheet
    .getRange(1, 1, highValueTaxaSheet.getMaxRows(), 1)
    .getValues()
    .reduce(function (itemTypes, row) {
      return itemTypes.concat(row[0]);
    }, [])
    .filter(function (i) {
      return Boolean(i);
    });

  const usersToCall = getAllOverdueUsers()
    .filter(function (user) {
      return (
        new Date(
          new Date(user["Latest Due Date"]).getTime() +
            minimumDaysOverdue * 24 * 60 * 60 * 1000
        ) < new Date()
      );
    })
    .filter(function (user) {
      // Has never been called or…
      return (
        !user["Most Recent Call"] ||
        // …hasn't been called in at least the past X days
        // Source: https://stackoverflow.com/questions/7687884/add-10-seconds-to-a-date
        new Date(
          new Date(user["Most Recent Call"]).getTime() +
            minimumDaysSinceLastCall * 24 * 60 * 60 * 1000
        ) < new Date()
      );
    })
    .filter(function (user) {
      return (
        !itemNameToSearch ||
        user["Overdue Item Names"]
          .toLowerCase()
          .indexOf(itemNameToSearch.toLowerCase()) > -1
      );
    })
    .filter(function (user) {
      return !user["should mark items as lost by member?"];
    })
    .filter(function (user) {
      if (!onlyHigherValueItems) {
        return true;
      }

      const itemTypes = user["Overdue Item Types"].split(";");

      // Ugh, `Set`s aren't supported in this engine either
      const allItemTypesToCheck = [];
      itemTypes.forEach(function (itemType) {
        if (allItemTypesToCheck.indexOf(itemType) === -1) {
          allItemTypesToCheck.push(itemType);
        }

        var parentTaxonName = itemType;
        while (true) {
          parentTaxonName = getParentTaxonName(parentTaxonName);
          if (parentTaxonName === null) {
            break;
          }
          if (allItemTypesToCheck.indexOf(parentTaxonName) === -1) {
            allItemTypesToCheck.push(parentTaxonName);
          }
        }
      });

      return allItemTypesToCheck.some(function (itemType) {
        return myTurnHighValueTaxa.indexOf(itemType) > -1;
      });
    });

  if (usersToCall.length === 0) {
    return SpreadsheetApp.getUi().alert("No calls need to be made right now");
  }

  const userToCall = getRandomItemFromArray(usersToCall);

  const t = HtmlService.createTemplateFromFile("callForm");
  t.config = getConfiguration();
  t.outcomeCategories = CALL_OUTCOME_CATEGORIES;
  t.userToCall = userToCall;
  SpreadsheetApp.getUi().showModalDialog(t.evaluate(), "Overdue call to make");
}

function initiateFilteredCallDialog() {
  const t = HtmlService.createHtmlOutputFromFile("callFilterForm");
  SpreadsheetApp.getUi().showModalDialog(t, "Filter your overdue call");
}

function initiateHigherValueCallDialog() {
  initiateCallDialog({ onlyHigherValueItems: true });
}
