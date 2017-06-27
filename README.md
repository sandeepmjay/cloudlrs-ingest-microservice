# cloudlrs-ingest-microservice

The ingest microservice implements all the functionality required to authenticate,
validate and ingest XAPI and Caliper learning statements.

The microservice uses [Serverless](https://serverless.com/framework/docs/) framework
to build and deploy to AWS.

## Prerequisites
  * Node.js v6.10.
  * Serverless CLI v1.9.0 or later. You can run  `npm install -g serverless` to install it.
  * An AWS account and Access keys in IAM
  * Set-up your Provider Credentials.


## Set up AWS CLI
The Access keys and secret can be created in IAM for the user account.
Configure the credentials using AWS CLI.

```
aws configure
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-west-2
Default output format [None]: ENTER
```

Alternatively, you can configure aws credentials using serverless command

```
serverless config credentials --provider aws --key AKIAIOSFODNN7EXAMPLE --secret wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

## Prepare the microservice package by running npm

```
npm install
npm install serverless --save-dev
```
Note: Install serverless only if using an already deployed function

# Manual Deployment to AWS

  * Zip the contents on the repo once the npm dependencies are resolved.
  * In Lambda console, click on Create New Lambda function and select runtime as Nodejs 6.10
    and blank function blueprint
  * Skip configure triggers, click next
  * Enter the configurations for
    - Name
    - Description
    - Runtime - Node.js 6.10
    - Code entry type as `Upload a zip file`
    - Handler as `index.handler`
    - Role as Existing Role 'cloud-lrs-ingest'
    - Under Advanced settings, set the following
      * Memory = 128,
      * Timeout = 30 sec
      * Enable active tracing
  * Select Create Function and Test it

# Deployments using Serverless Framework

## Configure Lambda deployment options in serverless.yml

Specify Lambda function config options as outline in the serverless.yml file.
Refer [Configuration Options](https://serverless.com/framework/docs/providers/aws/guide/services/) documentation.

## Deploy to AWS

```
serverless deploy -v
```

Alternatively functions can be explicitly specified if there are more services packaged in the deployment

```
serverless deploy function -f ingest
```


### Running local test using serverless emulator. Test data can be served using path and data options

```
serverless invoke local --function ingest --path test/data/caliperV1p1.json
serverless invoke local --function ingest --data { 1: 'hello', 2: 'world' }
```

### Deployed function can be invoked by using

```
serverless invoke --function ingest --path test/data/caliperV1p1.json
serverless invoke --function ingest --data { 1: 'hello', 2: 'world' }
```

## Terminate deployment using

```
serverless remove
```

Refer [Serverless Quick Start Guide](https://serverless.com/framework/docs/providers/aws/guide/quick-start/) for more details
