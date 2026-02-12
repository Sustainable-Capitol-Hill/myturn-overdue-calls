# Make MyTurn Overdue Calls

This is a Google Apps Script project that (when combined with its Google Sheet) helps your tool library identify and make phone calls to MyTurn patrons with long-overdue items. This both encourages returns, and (if the items are not returned within a set period of time) prompts you to update your tool library's MyTurn inventory to reflect that those tools are permanently lost.

This Google Apps Script project includes code to authenticate with and pull data from your [MyTurn](https://myturn.com) instance, and another module to add a [custom menu](https://developers.google.com/apps-script/guides/menus) to the Google Sheet to streamline staff phone calls to patrons with long-overdue items.

## Setup

### Configuration within the Google Sheet

#### `Configuration` sheet

Your Google Sheet has a `Configuration` sheet with cells that you can edit to identify your tool library and change some parameters of how the system works.

> [!NOTE]
> You should only ever edit the cells in the second column of the `Configuration` sheet (ie, the configuration _values_). You can also change these values whenever you'd like; for example, your tool library's opening hours might change in the future, or you might decide on a different policy about how long to wait between calls to patrons.

| Configuration field              | Details                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MyTurn Subdomain`               | This is the text _after_ `https://` and _before_ `.myturn.com` in your tool library's MyTurn URL. For example, for `https://capitolhill.myturn.com/library/` the value would be `capitolhill`.                                                                                                                                                                                                                                           |
| `Tool Library Name`              | This is your tool library's name. For example, `Capitol Hill Tool Library`.                                                                                                                                                                                                                                                                                                                                                              |
| `Open Hours Text`                | What hours your tool library is open. This text will appear in the suggested voicemail script. For example, you might say `Tuesdays 4 PM to 9 PM and weekends 10 AM to noon`.                                                                                                                                                                                                                                                            |
| `Days Overdue Before First Call` | The number of days to wait _after_ a patron's items become overdue before making them eligible to be phoned. (It's recommended that you set up [overdue reminder emails within your MyTurn](https://support.myturn.com/hc/en-us/articles/214580817-Automated-Email-Reminders) so that patrons with overdue items will have received multiple emails _before_ they get their first phone call!) The default value for this field is `60`. |
| `Maximum Phone Calls`            | The number of phone calls to make before "giving up on" a patron and assuming that they probably won't return their items. The default value for this field is `2`.                                                                                                                                                                                                                                                                      |
| `Minimum Days Between Calls`     | The number of days to wait _after_ a phone call before that patron is eligible to be called again; alternatively, if the patron has already received `Maximum Phone Calls` then the number of days to wait before marking them as delinquent and unlikely to ever return the items (ie, marking `Should Mark Items as Disabled?` as `TRUE` in the `Users with Overdue Items` sheet). The default value for this field is `14`.           |

#### `Configuration: MyTurn High-Value Item Taxonomies` sheet

_TODO_

### Configuration within the sheet's Apps Script interface

_TODO_
