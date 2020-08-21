# Urlmon
## About
Urlmon is a microservice that allows you to monitor http/https URLs in the background. It comes with a REST API that supports basic create/read/update/delete operations.

## Getting started
The easiest way to run Urlmon is to use Docker.
### Running with Docker
#### Requirements
* git
* docker-compose

#### 1. Clone the repository
```
git clone https://github.com/hajekjiri/urlmon.git
```

#### 2. Create a .env file
Use the included `.env.example` file as a template and change the username and/or password of the database user as you please. If you'd like to change the name of the database or the hostname, you'll have to reflect those changes in `database/init.sql` and `docker-compose.yml` respectively.
```
cp .env.example .env
```

#### 3. Run it
Use docker-compose to run the service. Once initialized, it will be accessible at http://localhost:5000.
```
docker-compose up
```

### Running without Docker
#### Requirements
* git
* Node.js
* MySQL database

#### 1. Clone the repository
```
git clone https://github.com/hajekjiri/urlmon.git
```

#### 2. Create a .env file
Use the included `.env.example` file as a template and change the variables to match your database.
```
cp .env.example .env
```

#### 3. Initialize your database
Create a database according to the name you chose in `.env`. If you decided not to go with the default name `urlmon`, you'll have to edit the first line of the `database/init.sql` script.
```
$ cat database/init.sql
use `urlmon`;
--   ^^^^^^ the name of your database goes here

...
```

Use the `database/init.sql` script to initialize your database.
```
mysql> use urlmon;
mysql> source database/init.sql;
```

#### 4. Install dependencies
Install dependencies via npm.
```
npm install
```

#### 5. Run it
Use the `start` npm script to run the service. Once initialized, it will be available at http://localhost:5000.
```
npm run start
```

## Note: managing users
There is currently no API to manage users. 2 users of them are included out-of-the-box with the the `database/init.sql` script but other than that, you'll have to manage them manually with SQL queries.
```
insert into Users values (null, 'John Doe', 'john@doe.xyz', 'hb6fk9x3-978c-fr4l-8y8a-gnn4hj98fdn4');
--                               ^ username  ^ email         ^ alphanumeric access token
```

## Data model and constraints
### MonitoredEndpoint
* represents a monitored URL/endpoint
#### Fields
##### id
* database id
* integer
* cannot be null
##### name
* name of the monitored endpoint
* string
* cannot be null
* must be between 3 and 100 characters long
##### url
* url of the monitored endpoint
* must use http or https
* string
* cannot be null
* maximum length is 100 characters
##### createdDate
* date and time of when the monitored endpoint was created
* datetime
* cannot be null
##### lastChecked
* date and time of when the monitored endpoint was last checked
* datetime
* can be null
##### monitoringInterval
* how often the monitored endpoint gets checked in seconds, i.e. the monitored endpoint gets checked every `monitoringInterval` seconds
* integer
* cannot be null
##### ownerId
* database id of the user who owns the monitored endpoint
* integer
* cannot be null

### MonitoringResult
* represents a response from a monitored endpoint
#### Fields
##### id
* database id
* integer
* cannot be null
##### checkedDate
* date and time of when the response was received
* datetime
* cannot be null
##### httpCode
* http code of the response
* integer
* can be null
##### contentType
* content type of the response
* string
* can be null
* maximum length is 100 characters
* gets cut to 100 characters if longer than 100 characters
##### payload
* payload of the response
* string
* can be null
* maximum size is 4 GiB
##### error
* error that came up while checking the endpoint
* string
* can be null
* maximum length is 200 characters
* gets cut to 200 characters if longer than 200 characters
##### monitoredEndpointId
* database id of the associated monitored endpoint
* integer
* cannot be null

### User
* represents a user
#### Fields
##### id
* database id
* integer
* cannot be null
##### username
* username of the user
* string
* cannot be null
* maximum length is 50 characters
##### email
* email of the user
* string
* cannot be null
* maximum length is 100 characters
##### accessToken
* access token of the user
* string
* cannot be null
* maximum length is 50 characters

## REST API endpoints
### Authentication
All endpoints require authentication. You are expected to store your access token in a header called `access-token`.

### Returned data
#### Success
```
{
  "data": returned_data
}
```

#### Error
```
{
  "error": "error_message"
}
```

### Endpoints
#### GET /endpoints
List monitored endpoints owned by the requesting user.
##### Status codes
* 200/OK
* 400/Bad Request
* 401/Unauthorized
* 404/Not Found
* 500/Internal Server Error
##### Example
```
$ curl -s http://localhost:5000/endpoints -H 'access-token: 93f39e2f-80de-4033-99ee-249d92736a25' | jq
{
  "data": [
    {
      "id": 1,
      "name": "GitHub",
      "url": "https://github.com",
      "createdDate": "2020-08-19T09:11:10.000Z",
      "lastCheckedDate": "2020-08-20T18:16:45.000Z",
      "monitoringInterval": 60,
      "ownerId": 1
    },
    {
      "id": 5,
      "name": "FIT CTU",
      "url": "http://fit.cvut.cz/",
      "createdDate": "2020-08-20T11:14:40.000Z",
      "lastCheckedDate": "2020-08-20T18:16:45.000Z",
      "monitoringInterval": 60,
      "ownerId": 1
    }
  ]
}
```

#### GET /endpoint/:id/results
List last 10 monitoring results for the monitored endpoint with matching id. The requesting user must own the monitored endpoint.
##### Responses
* 200/OK
* 400/Bad Request
* 401/Unauthorized
* 404/Not Found
* 500/Internal Server Error
##### Example
```
# skipping payloads because they are too large to display
$ curl -s 'http://localhost:5000/endpoint/1/results' -H 'access-token: 93f39e2f-80de-4033-99ee-249d92736a25' | jq
{
  "data": [
    {
      "id": 3580,
      "checkedDate": "2020-08-21T07:37:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3566,
      "checkedDate": "2020-08-21T07:36:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3553,
      "checkedDate": "2020-08-21T07:35:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3540,
      "checkedDate": "2020-08-21T07:34:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3526,
      "checkedDate": "2020-08-21T07:33:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3513,
      "checkedDate": "2020-08-21T07:32:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3500,
      "checkedDate": "2020-08-21T07:31:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3487,
      "checkedDate": "2020-08-21T07:30:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3474,
      "checkedDate": "2020-08-21T07:29:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    },
    {
      "id": 3461,
      "checkedDate": "2020-08-21T07:28:55.000Z",
      "httpCode": 200,
      "contentType": "text/html; charset=utf-8",
      "payload": ...,
      "error": null,
      "monitoredEndpointId": 1
    }
  ]
}
```

#### GET /result/:id
Returns the monitoring result with matching id. The requesting user must own the associated endpoint.
##### Responses
* 200/OK
* 400/Bad Request
* 401/Unauthorized
* 404/Not Found
* 500/Internal Server Error
##### Example
```
# skipping payload because it is too large to display
$ curl -s http://localhost:5000/result/1665 -H 'access-token: 93f39e2f-80de-4033-99ee-249d92736a25' | jq
{
  "data": {
    "id": 1665,
    "checkedDate": "2020-08-20T18:16:45.000Z",
    "httpCode": 200,
    "contentType": "text/html; charset=utf-8",
    "payload": ...,
    "error": null,
    "monitoredEndpointId": 1
  }
}
```

#### POST /endpoint
Create a new monitored endpoint for the authenticated user. Returns the created monitored endpoint.
##### Fields
* all fields except those listed below are ignored
###### name
* name of the monitored endpoint
* string
* cannot be null
* must be between 3 and 100 characters long
###### url
* url of the monitored endpoint
* must use http or https
* string
* cannot be null
* maximum length is 100 characters
###### monitoringInterval
* how often the monitored endpoint gets checked in seconds, i.e. the monitored endpoint gets checked every `monitoringInterval` seconds
* integer
* cannot be null
##### Responses
* 201/Created
* 400/Bad Request
* 401/Unauthorized
* 404/Not Found
* 500/Internal Server Error
##### Example
```
$ curl -s http://localhost:5000/endpoint -H 'access-token: 93f39e2f-80de-4033-99ee-249d92736a25' -X POST -F 'name=Arch Wiki' -F 'url=https://wiki.archlinux.org' -F 'monitoringInterval=120' | jq
{
  "data": {
    "id": 10,
    "name": "Arch Wiki",
    "url": "https://wiki.archlinux.org",
    "createdDate": "2020-08-20T18:41:50.634Z",
    "lastCheckedDate": null,
    "monitoringInterval": 120,
    "ownerId": 1
  }
}
```

#### PATCH /endpoint/:id
Update the monitored endpoint with matching id. The requesting user must own the monitored endpoint. Returns the updated monitored endpoint.
##### Fields
* all fields except those listed below are ignored
###### name
* name of the monitored endpoint
* string
* can be null
* must be between 3 and 100 characters long
###### url
* url of the monitored endpoint
* must use http or https
* string
* can be null
* maximum length is 100 characters
###### monitoringInterval
* how often the monitored endpoint gets checked in seconds, i.e. the monitored endpoint gets checked every `monitoringInterval` seconds
* integer
* can be null
##### Responses
* 200/OK
* 400/Bad Request
* 401/Unauthorized
* 404/Not Found
* 500/Internal Server Error
##### Example
```
$ curl -s http://localhost:5000/endpoint/10 -H 'access-token: 93f39e2f-80de-4033-99ee-249d92736a25' -X PATCH -F 'name=Arch Linux Wikipedia' -F 'monitoringInterval=200' | jq
{
  "data": {
    "id": 10,
    "name": "Arch Linux Wikipedia",
    "url": "https://wiki.archlinux.org",
    "createdDate": "2020-08-20T18:41:50.000Z",
    "lastCheckedDate": "2020-08-20T18:41:50.000Z",
    "monitoringInterval": 200,
    "ownerId": 1
  }
}
```

#### DEL /endpoint/:id
Delete the monitored endpoint with matching id. The requesting user must own the monitored endpoint. Returns the deleted monitored endpoint.
##### Responses
* 200/OK
* 400/Bad Request
* 401/Unauthorized
* 404/Not Found
* 500/Internal Server Error
##### Example
```
$ curl -s http://localhost:5000/endpoint/10 -H 'access-token: 93f39e2f-80de-4033-99ee-249d92736a25' -X DELETE | jq
{
  "data": {
    "id": 10,
    "name": "Arch Linux Wikipedia",
    "url": "https://wiki.archlinux.org",
    "createdDate": "2020-08-20T18:41:50.000Z",
    "lastCheckedDate": "2020-08-20T18:42:38.000Z",
    "monitoringInterval": 200,
    "ownerId": 1
  }
}
```
