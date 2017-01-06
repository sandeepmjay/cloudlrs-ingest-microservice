/**
 * Copyright ©2016. The Regents of the University of California (Regents). All Rights Reserved.
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

var AWS = require('aws-sdk');

AWS.config.region = "us-west-2";
AWS.config.apiVersions = {
  rds: '2013-09-09'
};

var pg = require('pg');
var config = require('config');
var joi = require('joi');
var AuthAPI = require('./lib/auth');
var DB = require('./lib/db');
var StatementAPI = require('./api');

exports.handler = function(event, context, callback) {
  // Verify write credentials
  require('./globals/sequelize.js');
  console.log('Starting DB init function');
  DB.init(function() {
    AuthAPI.verifyWriteAuth(context, event, function(err) {
      if (err) {
        context.fail(err.code + ' : ' + err.msg);
      }else{
        console.log('Connection Successful !!');
        console.log('Event :' + JSON.stringify(event));
        console.log('Context' + JSON.stringify(context));
        // Process the statement
        StatementAPI.saveStatement(context.ctx, event.body, function(err) {
          if (err) {
            context.fail(err.code + ' : '+ err.msg);
          }
          context.succeed("201 : Statement processing successful")
        });
      }
    });
  });
}
