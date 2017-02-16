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



/**
 * The function invokes appropriate api request handlers to process the incoming statements.
 *
 * @param  {Object}         event                     Message payload that will be used as event while invoking Lambda function
 * @param  {Object}         context                   Context object contains lambda runtime information such as functionName, CloudWatch log group etc.
 * @param  {Object}         callback.err              AN error that occurred, if any
 */
var statementIngestHandler = module.exports.statementIngestHandler = function(event, context, callback) {
  // Verify write credentials
  require('./globals/sequelize.js');
  console.log('Starting DB init function');
  console.log('Event begin : \n' + JSON.stringify(event));
  DB.init(function() {
    AuthAPI.verifyWriteAuth(context, event, function(err) {
      if (err) {
        console.log('Authentication failed. \n' + JSON.stringify(err));
        return callback(err);

      } else {
        console.log('Connection Successful !!');
        console.log('Event :' + JSON.stringify(event));
        console.log('Context :' + JSON.stringify(context));

        // TODO : Add a switch case to handler XAPI or Caliper statements accordingly.
        // Process and save XAPI statement
        StatementXAPI.saveStatement(context.ctx, event.body, function(err, statement) {
          if (err) {
            console.log('Error during save: \n' + JSON.stringify(err));
            return callback(err);
          } else {
            console.log('201 : Statement processing successful');
            return callback(null, statement);
          }
        });
      }
    });
  });
}
