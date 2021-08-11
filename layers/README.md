Install AWS Lambda Layer & Puppeteer core

Added the layers in a separate service to prevent from uploading everytime the service stack is deployed.

```
git clone --depth=1 https://github.com/alixaxel/chrome-aws-lambda.git && \
cd chrome-aws-lambda && \
make chrome_aws_lambda.zip
```
