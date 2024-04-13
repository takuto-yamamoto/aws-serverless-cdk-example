#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { ExampleBackendStack } from '../lib/backend-stack';
import { ExampleFrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const ENV = app.node.tryGetContext('CDK_ENV');

new ExampleBackendStack(app, `ExampleBackendStack-${ENV}`);
new ExampleFrontendStack(app, `ExampleFrontendStack-${ENV}`);
