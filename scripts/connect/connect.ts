import { Connect, AWSError, Response, Lambda, STS } from 'aws-sdk';

const AwsConnect = new Connect({
  apiVersion: '2017-08-08',
  region: process.env['REGION']
});

const AwsLambda = new Lambda({
  apiVersion: '',
  region: process.env['REGION'],
  // credentials: new Credentials({
  //   accessKeyId: '',
  //   secretAccessKey: '',
  //   sessionToken: ''
  // })
});

const AwsSTS = new STS({
  region: process.env['REGION']
});

export class VFConnect {
  public async associateLambdas(lambdaArns: string[], instanceId: string): Promise<{ $response: Response<{}, AWSError>; }[]> {
    /**
     * AssociateLambdaFunction
     * var params = {
     *   FunctionArn: 'STRING_VALUE', // required
     *   InstanceId: 'STRING_VALUE' // required
     * };
     * connect.associateLambdaFunction(params, function(err, data) {
     *   if (err) console.log(err, err.stack); // an error occurred
     *   else     console.log(data);           // successful response
     * });
     * 
     * @param lambdaArns - array of strings - lambda arns to be associated with a connect instance
     * @param instanceId - string - the connect instance id to associate with
     */

    this.validateEnvVars();

    const lambdaAssociations: Promise<{$response: Response<{}, AWSError>}>[] = lambdaArns.map(arn => {
      return AwsConnect.associateLambdaFunction({
        FunctionArn: arn,
        InstanceId: instanceId
      }).promise();
    });
    
    return await Promise.all(lambdaAssociations);
  }

  public async promoteContactFlow(instanceId: string, flowName: string) {
    /**
     * describeContactFlow
     * var params = {
     *   ContactFlowId: 'STRING_VALUE', // required
     *   InstanceId: 'STRING_VALUE' // required
     * };
     * connect.describeContactFlow(params, function(err, data) {
     *   if (err) console.log(err, err.stack); // an error occurred
     *   else     console.log(data);           // successful response
     * });
     * 
     * @param instanceId - string - the connect instance containing the desired contact flow
     * @param flowName - string - the contact flow name in question
     */

    this.validateEnvVars();


    // need the contact flow id to get its content, therefore list flows and map to name

    const contactFlows: Connect.ListContactFlowsResponse = await AwsConnect.listContactFlows({
      InstanceId: instanceId
    }).promise();

    const flowId: string = contactFlows.ContactFlowSummaryList.find(flow => flow.Name === flowName).Id;

    const contactFlowData: Connect.DescribeContactFlowResponse = await AwsConnect.describeContactFlow({
      ContactFlowId: flowId,
      InstanceId: instanceId
    }).promise();

    const contactFlowContent: string = contactFlowData.ContactFlow.Content;

    // 'lambda-001-sam-dev-get-assigned-analyst'
    // 'lambda-001-sam-qa-get-assigned-analyst'

    console.log('describeContactFlow completed successfully');
  }

  public async testSTS() {
    process.env['AWS_PROFILE'] = 'vf-team7';
    const foo = await AwsSTS.assumeRole({
      RoleArn: 'arn:aws:iam::538718130184:role/kraus-test-cross-account',
      RoleSessionName: 'pipeline-session'
    }).promise();


    console.log(foo.Credentials);
  }

  private validateEnvVars() {
    const unsetEnvVars: string[] = [];
    if(!process.env['AWS_PROFILE']) unsetEnvVars.push('AWS_PROFILE');
    if(!process.env['REGION']) unsetEnvVars.push('REGION');
    if(!process.env['LOWER_STAGE']) unsetEnvVars.push('LOWER_STAGE');
    if(!process.env['HIGHER_STAGE']) unsetEnvVars.push('HIGHER_STAGE');
    if(unsetEnvVars.length > 0) throw new Error(`The following environment variables must be set:\n${unsetEnvVars.join(' ')}`);
  }
}