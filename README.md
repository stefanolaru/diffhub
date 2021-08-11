# Automate Website Testing

🚧 [Work in Progress]

DiffHub is a automated testing service that runs in AWS and makes it really easy to test websites and APIs.

Includes a CloudFormation template that

-   creates a DynamoDB table to store logs (with TTL) & config
-   creates a IAM User with a policy to write DynamoDB & SES
-   creates a SES Template to notify recipients in case of failure or service back to normal

The Lambda function is triggered via a EventBridge event rule every 5 minutes

See Documentation: https://docs.diffhub.com/
