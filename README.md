# uptimemonitor

Deploy a free uptime monitor using AWS &amp; Serverless

Includes a CloudFormation template that

-   creates a DynamoDB table to store logs (with TTL)
-   creates a IAM User with a policy to write DynamoDB, SNS & SES (to be used for alerts)
-   creates a SNS Topic to receive failures

The Serverless framework creates a Lambda function that attempts to load the configured websites.

The Lambda function is triggered via a EventBridge event rule every 5 minutes
