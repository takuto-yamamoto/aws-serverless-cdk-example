#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { ExampleBackendStack } from '../lib/backend-stack';
import { ExampleFrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const ENV = app.node.tryGetContext('CDK_ENV');
if (!ENV) {
  throw new Error('--contextオプションに CDK_ENV を設定してください');
}

// 個人環境はfrontendリソースを立てない（localhostを利用）
if (ENV === 'prod' || ENV === 'dev') {
  new ExampleFrontendStack(app, `ExampleFrontendStack-${ENV}`);
}

new ExampleBackendStack(app, `ExampleBackendStack-${ENV}`);
