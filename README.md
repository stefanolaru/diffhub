# Free Uptime monitor service

Deploy a free uptime monitor using AWS &amp; Serverless

Includes a CloudFormation template that

-   creates a DynamoDB table to store logs (with TTL) & config
-   creates a IAM User with a policy to write DynamoDB & SES
-   creates a SES Template to notify recipients in case of failure or service back to normal

The Serverless framework creates a Lambda function that attempts to load the configured websites.

The Lambda function is triggered via a EventBridge event rule every 5 minutes
