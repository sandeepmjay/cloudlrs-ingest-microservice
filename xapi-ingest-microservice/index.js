/**
 * Copyright ©2017. The Regents of the University of California (Regents). All Rights Reserved.
 *
 * Permission to use, copy, modify, and distribute this software and its documentation
 * for educational, research, and not-for-profit purposes, without fee and without a
 * signed licensing agreement, is hereby granted, provided that the above copyright
 * notice, this paragraph and the following two paragraphs appear in all copies,
 * modifications, and distributions.
 *
 * Contact The Office of Technology Licensing, UC Berkeley, 2150 Shattuck Avenue,
 * Suite 510, Berkeley, CA 94720-1620, (510) 643-7201, otl@berkeley.edu,
 * http://ipira.berkeley.edu/industry-info for commercial licensing opportunities.
 *
 * IN NO EVENT SHALL REGENTS BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL,
 * INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF
 * THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF REGENTS HAS BEEN ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * REGENTS SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE
 * SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED
 * "AS IS". REGENTS HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES,
 * ENHANCEMENTS, OR MODIFICATIONS.
 */

'use strict';

const AWS = require('aws-sdk');

const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
const Lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });

AWS.config.region = 'us-west-2';
AWS.config.apiVersions = {
  rds: '2013-09-09'
};

var IngestAPI = require('./ingest')

// Queue URL stored in the queueUrl environment variable
const QUEUE_URL = process.env.queueUrl;
const PROCESS_MESSAGE = 'process-message';

/**
 * Invoked polling lambda function with appropriate lambda parameters.
 *
 * @param  {String}         functionName             The name of the lambda function to be invoked.
 * @param  {Object}         message                  Message payload that will be used as event while invoking Lambda function
 */
function invokePoller(functionName, message) {
  const payload = {
    operation: PROCESS_MESSAGE,
    message
  };
  const params = {
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: new Buffer(JSON.stringify(payload))
  };
  console.log(payload.message.Body);
  return new Promise((resolve, reject) => {
    Lambda.invoke(params, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Invoked polling lambda function with appropriate lambda parameters.
 *
 * @param  {Object}           message                   Message payload that will be used as event while invoking Lambda function
 * @param  {Object}           context                   Context object contains lambda runtime information such as functionName, CloudWatch log group etc.
 * @param  {Object}           callback.err              An error that occurred, if any
 * @param  {Object}           callback.statement        The statement that was accepted into the LRS
 */
function processMessage(message, context, callback) {
  console.log('Message body from the poller:\n' + message.Body);

  IngestAPI.statementIngestHandler(JSON.parse(message.Body), context, function(err, statement) {
    if(err) {
      console.log('400: Error during statement ingest:\n' + JSON.stringify(err));
    } else {
      // delete message
      const params = {
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle
      };
      SQS.deleteMessage(params, (err) => callback(err, message));
      console.log('201: Statement accepted to LRS with uuid '+ JSON.stringify(statement.uuid)+ '!');
    }
  });
}

/**
 * The function polls SQS and retrieves 10 messages at a time. Lambda functions are invoked for each of the messages for processing.
 *
 * @param  {Object}         functionName              Message payload that will be used as event while invoking Lambda function
 * @param  {Object}         callback.err              AN error that occurred, if any
 */
function poll(functionName, callback) {
  const params = {
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 10
  };
  // batch request messages
  SQS.receiveMessage(params, (err, data) => {
    if (err) {
      return callback(err);
    }
    // for each message, reinvoke the function
    const promises = data.Messages.map((message) => invokePoller(functionName, message));
    // complete when all invocations have been made
    Promise.all(promises).then(() => {
      const result = `Messages received: ${data.Messages.length}`;
      console.log(result);
      callback(null, result);
    });
  });
}

/**
 * The poller lambda handler entry point.
 *
 * @param  {Object}         event                     Message payload that will be used as event while invoking Lambda function
 * @param  {Object}         context                   Context object contains lambda runtime information such as functionName, CloudWatch log group etc.
 * @param  {Object}         callback.err              AN error that occurred, if any
 */
exports.handler = (event, context, callback) => {
  try {
    if (event.operation === PROCESS_MESSAGE) {
      // invoked by poller
      processMessage(event.message, context, callback);
    } else {
      // invoked by Cloudwatch scheduler
      poll(context.functionName, callback);
    }
  } catch (err) {
    callback(err);
  }
};
