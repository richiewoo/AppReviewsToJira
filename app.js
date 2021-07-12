
const axios = require('axios')
const moment = require('moment-timezone')
const jiraHost = require("./env/jiraEnv.js").jiraHost
var JiraApi = require("jira").JiraApi
var JiraClient = require("jira-connector")
var fs = require("fs");
const reportedFilename = 'reported-review.txt'
const reviewsSeparator = '&&'

axios.defaults.headers.common['X-Client-Key'] = process.env.APPFIGURES_CLIENT_KEY
axios.defaults.headers.common.Authorization = `Basic ${process.env.BASIC_AUTHORIZATION_KEY}`

;(async () => {
  // fetch reviews from app store
  const r = await axios.get('https://api.appfigures.com/v2/reviews')
  const oneDayAgo = moment().subtract(2, 'days').utc().format()
  const newReviews = r.data.reviews.filter(review => moment(review.date).tz('EST').utc().format() > oneDayAgo)

  // read the reviews filed already 
  var data =''
  try {
    console.log('Read data file:')
    data = fs.readFileSync(reportedFilename, 'utf8')
  } catch (err) {
    console.error(err)
  }

  var reportedReviews = []
  if(data !== '') {
    console.log('Data:')
    console.log(data)

    reportedReviews = data.split(reviewsSeparator)

    console.log(reportedReviews)

  } else {
    console.log('Empty data')
  }

  // create jira client
  var jira = new JiraClient({
    host: jiraHost,
    basic_auth: {
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    }
  }); 

  // create jira ticket for bad review
  var newReportedReviews = ''
  for(let review of newReviews.filter(checkStar)) {
    console.log(review)

    var desc = `

    User *${review.author}* posted review for *${review.product_name}* *${review.store === 'apple' ? 'iOS' : 'Android'}* ${review.version}
    *Stars*: ${review.stars}
    *Title*: ${review.title}
    *Content*: ${review.original_review}
    `
    /*if(review.version === '') {
      // ignore if no version
      continue
    }
    */

    var versionNum = review.version.split(".").slice(0, 3).join(".");
    var version = review.store === 'apple' ? "mThor iOS " + versionNum : "mThor Android " + versionNum;
    var component = review.store === 'apple' ? "iOS" : "Android";

    var title = review.review//review.title === '' ? review.review : title

    var reviewIdentidy = review.author + '$$' + review.date

    //check if it is already filed a ticket
    if(!reportedReviews.includes(reviewIdentidy)) {
      console.log("need to file")
    } else {
      console.log("already filed")
      newReportedReviews = newReportedReviews + reviewsSeparator + reviewIdentidy
      console.log("Write data file: " + newReportedReviews)
      try {
        if(newReportedReviews !== '') {
          const data = fs.writeFileSync(reportedFilename, newReportedReviews)
        } else {
          console.log(newReportedReviews)
        }
      } catch (error) {
        console.error(error)
      }

      continue
    }

    try {
      const issue = await reportReview(
        jira,
        title,
        desc,
        version,
        component
        )

        jiraid = issue.key;
        jiralink = "https://" + jiraHost + "/browse/" + jiraid;
        console.log('jiralink: ' + jiralink)

        newReportedReviews = newReportedReviews + reviewsSeparator + reviewIdentidy

        console.log("Write data file: " + newReportedReviews)
        if(newReportedReviews !== '') {
          const data = fs.writeFileSync(reportedFilename, newReportedReviews)
        } else {
          console.log(newReportedReviews)
        }

    } catch (error) {
      console.error(error)
    }

    /*
     // create jira ticket
    let createJiraPromise = reportReview(
      jira,
      title,
      desc,
      version,
      component
      )
    
    createJiraPromise.then(

      function(issue) {
        jiraid = issue.key;
        jiralink = "https://" + jiraHost + "/browse/" + jiraid;
        console.log('jiralink: ' + jiralink)

        newReportedReviews = newReportedReviews + reviewsSeparator + reviewIdentidy

        console.log("Write data file: " + newReportedReviews)
        try {
          if(newReportedReviews !== '') {
            const data = fs.writeFileSync(reportedFilename, newReportedReviews)
          } else {
            console.log(newReportedReviews)
          }
        } catch (err) {
          console.error(err)
        }
      },
      function(error) {
        console.error(error)
      }
    )*/
  }

})()

function checkStar(review) {
  return review.stars < '3'
}

function reportReview(jira, title, description, version, component) {

  console.log("Title: " + title)
  console.log("Description: " + description)
  console.log("Version: " + version)

  const projectId = 19953// AS: 21475 https://jira.ringcentral.com/projects/AS/summary. mThor: 16552

  return new Promise(function(resolve, reject) {
    var affectstr = new Array();

    var obj = new Object();
    obj.name = version;
    affectstr.push(obj)
    
    jira.issue.createIssue(
      {
        fields: {
          project: { id: projectId },
          summary: title.substr(0, 254),
          description: description,
          issuetype: { name: "Ticket" },
          priority: { name: "Normal" },
          components: [{ name: component }],
          //versions: affectstr             
        }
      },
      function(error, issue) {
        if (error) {
          //console.error(error);
          reject(error)
        } else {
          resolve(issue);
        }
      }
    );
  });
}

