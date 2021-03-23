import { Connect, AWSError, Response, STS, Credentials } from 'aws-sdk';

const SourceEnvConnect = new Connect({
  apiVersion: '2017-08-08',
  region: process.env['REGION']
});

const DestinationEnvConnect = new Connect({
  apiVersion: '2017-08-08',
  region: process.env['REGION']
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
      return SourceEnvConnect.associateLambdaFunction({
        FunctionArn: arn,
        InstanceId: instanceId
      }).promise();
    });
    
    return await Promise.all(lambdaAssociations);
  }

  public async promoteContactFlow(props) {
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

    const {
      sourceInstanceId,
      destinationInstanceId,
      assumeRoleArn,
      flowName
    } = props;

    // need the contact flow id to get its content, therefore list flows and map to name

    const sourceContactFlows: Connect.ListContactFlowsResponse = await SourceEnvConnect.listContactFlows({
      InstanceId: sourceInstanceId
    }).promise();

    const flowId: string = sourceContactFlows.ContactFlowSummaryList.find(flow => flow.Name === flowName).Id;

    const sourceContactFlowData: Connect.DescribeContactFlowResponse = await SourceEnvConnect.describeContactFlow({
      ContactFlowId: flowId,
      InstanceId: sourceInstanceId
    }).promise();

    const sourceContactFlowContent: string = sourceContactFlowData.ContactFlow.Content;

    console.log('sourceContactFlowContent:', sourceContactFlowContent);

    // 'kraus-team7-foo'
    // 'kraus-team9-foo'

    const destinationCredentials: STS.Credentials = await this.assumeRole(assumeRoleArn);

    const DestinationEnvConnect = new Connect({
      credentials: new Credentials({
        accessKeyId: destinationCredentials.AccessKeyId,
        secretAccessKey: destinationCredentials.SecretAccessKey
      })
    });

    console.log('describeContactFlow completed successfully');
  }

  private async assumeRole(roleArn: string): Promise<STS.Credentials> {
    const foo = await AwsSTS.assumeRole({
      RoleArn: roleArn,
      RoleSessionName: 'pipeline-session' // TODO: discuss naming this with team
    }).promise();

    return foo.Credentials;
  }

  private validateEnvVars() {
    const unsetEnvVars: string[] = [];
    if(!process.env['AWS_PROFILE']) unsetEnvVars.push('AWS_PROFILE');
    if(!process.env['REGION']) unsetEnvVars.push('REGION');
    // if(!process.env['SOURCE_ENV']) unsetEnvVars.push('SOURCE_ENV');
    // if(!process.env['DESTINATION_ENV']) unsetEnvVars.push('DESTINATION_ENV');
    if(unsetEnvVars.length > 0) throw new Error(`The following environment variables must be set:\n${unsetEnvVars.join(' ')}`);
  }
}