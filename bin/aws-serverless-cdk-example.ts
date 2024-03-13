#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ExampleBackendStack } from '../lib/backend-stack';

const app = new cdk.App();

const ENV = app.node.tryGetContext('CDK_ENV');
if (!ENV) {
  throw new Error('--contextオプションに CDK_ENV を設定してください');
}

new ExampleBackendStack(app, `ExampleBackendStack-${ENV}`);
