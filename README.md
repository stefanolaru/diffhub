# Automate Website Testing

DiffHub makes it really easy to create automated tests for your website and spot the bugs ahead of your users.
Spend less time on manual testing and more time doing the work you love.

Deploy a website testing service on AWS, run website or API tests in the cloud for free (excluding AWS costs).

Includes a CloudFormation template that

-   creates a DynamoDB table to store logs (with TTL) & config
-   creates a IAM User with a policy to write DynamoDB & SES
-   creates a SES Template to notify recipients in case of failure or service back to normal

The Lambda function is triggered via a EventBridge event rule every 5 minutes
