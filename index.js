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

var pg = require('pg');
var config = require('config');
var joi = require('joi');
var AuthAPI = require('./lib/auth');
var DB = require('./lib/db');
var StatementXAPI = require('./lib/xapi');
var StatementCaliper = require('./lib/caliper');

/**
 * The function invokes appropriate api request handlers to process the incoming statements.
 *
 * @param  {Object}         event                     Message payload that will be used as event while invoking Lambda function
 * @param  {Object}         context                   Context object contains lambda runtime information such as functionName, CloudWatch log group etc.
 * @param  {Object}         callback.err              An error that occurred with custom response payload, if any
 * @param  {Object}         callback.response         Response object with the result and log stream information packaged as payload
 */
exports.handler = function(event, context, callback) {
  require('./globals/sequelize.js');
  var request = null;
  var response = {
    'logGroupName': context.logGroupName,
    'logStreamName': context.logStreamName,
    'functionName': context.functionName,
    'invokeid': context.invokeid,
    'result': '',
    'code': null,
    'msg': ''
  }

  if (typeof event === 'string') {
    try {
      request = JSON.parse(event);
    } catch (err) {
      console.log("Request is not a well formed JSON");
      response.result = 'Failed';
      response.code = 400;
      response.msg = 'Request not a well formed JSON';
      context.callbackWaitsForEmptyEventLoop = false;
      return callback(JSON.stringify(response));
    }
  } else if (typeof event === 'object') {
    request = event;
  } else {
    console.log("Request is not a well formed JSON object");
    response.result = 'Failed';
    response.code = 400;
    response.msg = 'Request not a well formed JSON';
    context.callbackWaitsForEmptyEventLoop = false;
    return callback(JSON.stringify(response));
  }
  // Sync data model
  DB.init(function() {
    // Verify write credentials
    AuthAPI.verifyAuth(context, function(err) {
      if (err) {
        console.log('Authentication failed. \n' + JSON.stringify(err));
        response.result = 'Failed';
        response.code = 401;
        response.msg = 'Authentication Failed. Check your credentials';
        context.callbackWaitsForEmptyEventLoop = false;
        return callback(JSON.stringify(response));
      }

      console.log('Connection Successful !!');
      console.log('Event :' + JSON.stringify(event));
      console.log('Context :' + JSON.stringify(context));

      getStatementType(context.ctx, request, function(err, statementType) {
        if (err) {
          console.log("Unknown Statement type.\n" + JSON.stringify(err));
          response.result = 'Failed';
          response.code = 400;
          response.msg = 'Statement not in xAPI or Caliper format';
          context.callbackWaitsForEmptyEventLoop = false;
          return callback(JSON.stringify(response));
        }

        // Process and save XAPI and Caliper statements accordingly
        switch (statementType) {
          case 'XAPI':
            // Invoke XAPI handler
            StatementXAPI.saveStatement(context.ctx, request, function(err, statement) {
              if (err) {
                console.log('Error during save: \n' + JSON.stringify(err));
                response.result = 'Failed';
                response.code = err.code || 400;
                response.msg = err.msg || 'Error during save: \n' + JSON.stringify(err);
                context.callbackWaitsForEmptyEventLoop = false;
                return callback(JSON.stringify(response));

              } else {
                console.log('201 : XAPI statement processing successful with uuid: ' + statement.uuid);
                response.msg = 'XAPI statement processing successful with uuid: ' + statement.uuid;
                response.result = 'Success';
                response.code = 201;
                context.callbackWaitsForEmptyEventLoop = false;
                return callback(null, response);
              }
            });
            break;
          case 'CALIPER':
            // Invoke Caliper handler
            StatementCaliper.saveStatement(context.ctx, request, function(err, statement) {
              if (err) {
                console.log('Error during save: \n' + JSON.stringify(err));
                response.result = 'Failed';
                response.code = err.code || 400;
                response.msg = err.msg || 'Error during save: \n' + JSON.stringify(err);
                context.callbackWaitsForEmptyEventLoop = false;
                return callback(JSON.stringify(response));

              } else {
                var result = '201 : Caliper statement processing successful with uuid: ' + statement.uuid;
                console.log(result);
                response.result = 'Success';
                response.code = 201;
                response.msg = 'Caliper statement processing successful with uuid: ' + statement.uuid;
                context.callbackWaitsForEmptyEventLoop = false;
                return callback(null, response);
              }
            });
            break;
          default:
            console.log('Statement not in XAPI or Caliper format');
            response.result = 'Failed';
            response.code = 400;
            response.msg = 'Statement not in xAPI or Caliper format';
            context.callbackWaitsForEmptyEventLoop = false;
            return callback(JSON.stringify(response));
            break;
        }
      });
    });
  });
}

/**
 * The function determines which the statement type for the incoming request so that suitable handlers can be invoked subsequently.
 *
 * @param  {Object}         context                      Context object contains lambda runtime information such as functionName, CloudWatch log group etc.
 * @param  {Object}         statement                    Message payload that will be used as request while invoking Lambda function
 * @param  {Object}         callback.err                 An error that occurred if statement type is not XAPI or CALIPER type, if any
 * @param  {Object}         callback.statementType       Statement type that was determined
 */

var getStatementType = function(context, statement, callback) {
  var statementType = '';
  if (statement.hasOwnProperty('id') && statement.hasOwnProperty('@context') && statement.hasOwnProperty('eventTime') && statement.hasOwnProperty('actor') && statement.hasOwnProperty('object')) {
    statementType = 'CALIPER';
    console.log("Incoming statement is of type CALIPER");
  } else if (statement.hasOwnProperty('id') && statement.hasOwnProperty('actor') && statement.hasOwnProperty('verb') && statement.hasOwnProperty('object') && statement.hasOwnProperty('timestamp')) {
    statementType = 'XAPI';
    console.log("Incoming statement is of type XAPI");
  } else {
    return callback(new Error('Statement not in xAPI or Caliper format'));
  }

  return callback(null, statementType);
};
