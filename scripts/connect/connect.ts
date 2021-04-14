import { Connect, AWSError, Response, STS, Credentials } from 'aws-sdk';

interface IPromoteContactFlowProps {
  sourceInstanceId: string;
  destinationInstanceId: string;
  assumeRoleArn: string;
  flowNames: string[];
}

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
    this.validateEnvVars();

    // Filter out any lambda arns passed in that are already associated.
    const currentLambdas: Connect.ListLambdaFunctionsResponse = await SourceEnvConnect.listLambdaFunctions({
      InstanceId: instanceId,
      MaxResults: 1000
    }).promise();
    
    const unassociatedLambdas: string[] = lambdaArns.filter(arn => !currentLambdas.LambdaFunctions?.includes(arn));

    const lambdaAssociations: Promise<{$response: Response<{}, AWSError>}>[] = unassociatedLambdas.map(arn => {
      return SourceEnvConnect.associateLambdaFunction({
        FunctionArn: arn,
        InstanceId: instanceId
      }).promise();
    });
    
    return await Promise.all(lambdaAssociations);
  }

  public async promoteContactFlow(props: IPromoteContactFlowProps) {
    this.validateEnvVars();

    const {
      sourceInstanceId,
      destinationInstanceId,
      assumeRoleArn,
      flowNames
    } = props;

    // need the contact flow id to get its content, therefore list flows and map to name
    const sourceContactFlows: Connect.ListContactFlowsResponse = await SourceEnvConnect.listContactFlows({
      InstanceId: sourceInstanceId,
      MaxResults: 1000
    }).promise();

    const flowSummaries: Connect.ContactFlowSummary[] = sourceContactFlows?.ContactFlowSummaryList?.filter(summary => flowNames.includes(summary?.Name as string)) as Connect.ContactFlowSummary[];

    const updatedFlowSummaries: Connect.DescribeContactFlowResponse[] = await Promise.all(
      flowSummaries.map((summary) => {
        return SourceEnvConnect.describeContactFlow({
          ContactFlowId: summary.Id as string,
          InstanceId: sourceInstanceId
        }).promise();
      })
    );

    console.log('updatedFlowSummaries:', updatedFlowSummaries);

    // const sourceContactFlowData: Connect.DescribeContactFlowResponse = await SourceEnvConnect.describeContactFlow({
    //   ContactFlowId: ,
    //   InstanceId: sourceInstanceId
    // }).promise();

    // const sourceContactFlowContent: string = sourceContactFlowData?.ContactFlow?.Content as string;

    // console.log('sourceContactFlowContent:', sourceContactFlowContent);

    // const destinationCredentials: STS.Credentials = await this.assumeDestinationRole(assumeRoleArn);

    // const DestinationEnvConnect = new Connect({
    //   credentials: new Credentials({
    //     accessKeyId: destinationCredentials.AccessKeyId,
    //     secretAccessKey: destinationCredentials.SecretAccessKey
    //   })
    // });

    console.log('describeContactFlow completed successfully');
  }

  private async assumeDestinationRole(roleArn: string): Promise<STS.Credentials> {
    const assumeRoleResponse: STS.AssumeRoleResponse = await AwsSTS.assumeRole({
      RoleArn: roleArn,
      RoleSessionName: `pipeline-session-${new Date()}` // TODO: discuss naming this with team
    }).promise();

    return assumeRoleResponse.Credentials as STS.Credentials;
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