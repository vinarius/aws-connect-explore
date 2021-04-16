import { Connect, STS, Lambda, Response, AWSError, Credentials } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

interface IPromoteContactFlowProps {
  sourceInstanceId: string;
  destinationInstanceId: string;
  assumeRoleArn: string;
  flowNames: string[];
}

const SourceEnvConnect = new Connect({
  apiVersion: '2017-08-08',
  region: process.env['SOURCE_REGION']
});

const AwsSTS = new STS({
  region: process.env['SOURCE_REGION']
});

interface IAssociateLambdaProps {
  inputLambdaNames: string[];
  destinationInstanceId: string;
  assumeRoleArn: string;
  profile: string;
  destinationRegion: string;
}

interface IListRoutingProfilesProps {
  instanceId: string;
}

interface IRoutingProfile {
  description?: string;
  name?: string;
  defaultOutboundQueueId?: string;
  mediaConcurrencies?: {
    Channel?: string;
    Concurrency?: number;
  }[];
  queueConfigs?: {
    delay?: number;
    priority?: number;
    queueReference?: {
      channel?: 'VOICE' | 'CHAT' | 'TASK';
      queueId?: string;
    }
  }[];
  tags: {
    [key: string]: string;
  };
}

export class VFConnect {
  public async associateLambdas(props: IAssociateLambdaProps): Promise<{ $response: Response<{}, AWSError>; }[]> {
    this.validateEnvVars();

    const {
      assumeRoleArn,
      inputLambdaNames,
      destinationInstanceId,
      profile,
      destinationRegion
    } = props;

    const {AccessKeyId, SecretAccessKey, SessionToken}: STS.Credentials = await this.assumeDestinationRole(assumeRoleArn, profile);
    const credentials = new Credentials({
      accessKeyId: AccessKeyId,
      secretAccessKey: SecretAccessKey,
      sessionToken: SessionToken
    });

    const DestinationEnvConnect = new Connect({credentials, region: destinationRegion});
    const DestinationEnvLambda = new Lambda({credentials, region: destinationRegion});

    // Get all lambda functions based on name
    const allLambdaFunctions: Lambda.FunctionList = [];
    let nextToken = undefined;
    do {
      const params: Lambda.ListFunctionsRequest = {MaxItems: 1000};
      if(nextToken) {
        params.Marker = nextToken;
      }
      const {Functions, NextMarker} = await DestinationEnvLambda.listFunctions(params).promise();
      nextToken = NextMarker;
      Functions?.forEach(lambda => allLambdaFunctions.push(lambda));
    } while (nextToken)

    // Verify all requested lambda functions exist in destination account.
    const missingLambdas: string[] = inputLambdaNames.filter(name => !allLambdaFunctions.some(lambda => lambda.FunctionName === name));
    if(missingLambdas.length > 0) {
      throw new Error(`The following lambdas do not exist in the destination account:\n${missingLambdas.join(' ')}\n`);
    }
    
    // Map name to arn
    const targetLambdaArns: string[] = allLambdaFunctions.filter(lambda => inputLambdaNames.includes(lambda.FunctionName as string))
      .map(lambda => lambda.FunctionArn as string);
      
    // Get all lambda arns that are already associated with connect
    let connectLambdaArns: Connect.FunctionArnsList = [];
    nextToken = undefined;
    do {
      const params: Connect.ListLambdaFunctionsRequest = {
        InstanceId: destinationInstanceId,
        MaxResults: 25 // Max is 25 for this api.
      }
      if(nextToken) {
        params.NextToken = nextToken;
      }
      const {LambdaFunctions, NextToken} = await DestinationEnvConnect.listLambdaFunctions(params).promise();
      nextToken = NextToken;
      LambdaFunctions?.forEach(lambdaArn => connectLambdaArns.push(lambdaArn));
    } while (nextToken)

    // Filter out any lambda arns passed in that are already associated.
    const unassociatedLambdaArns = targetLambdaArns?.filter((lambdaArn: string) => !connectLambdaArns.includes(lambdaArn));

    const lambdaAssociations: Promise<{ $response: Response<{}, AWSError>; }>[] = unassociatedLambdaArns.map(arn => {
      return DestinationEnvConnect.associateLambdaFunction({
        FunctionArn: arn,
        InstanceId: destinationInstanceId
      }).promise();
    });
    
    return await Promise.all(lambdaAssociations);
  }

  // TODO: createRoutingProfiles
  public async createRoutingProfiles(props: any): Promise<void> {
    /**
     * required params:
     * @param DefaultOutboundQueueId
     * @param Description
     * @param InstanceId
     * @param MediaConcurrencies
     * @param Name
     * @param QueueConfigs
     * 
     */
    
  }

  // TODO: getRoutingProfiles
  public async getRoutingProfiles(props: IListRoutingProfilesProps): Promise<void> {
    this.validateEnvVars();

    const {
      instanceId
    } = props;

    const routingProfileSummaries: Connect.RoutingProfileSummary[] = [];
    let nextToken = undefined;
    do {
      const params: Connect.ListRoutingProfilesRequest = {
        InstanceId: instanceId,
        MaxResults: 1000,
      };
      if(nextToken) {
        params.NextToken = nextToken;
      }
      const {RoutingProfileSummaryList, NextToken} = await SourceEnvConnect.listRoutingProfiles(params).promise();
      nextToken = NextToken;
      RoutingProfileSummaryList?.forEach(summary => routingProfileSummaries.push(summary));
    } while(nextToken)

    console.log('routingProfileSummaries:', routingProfileSummaries);

    const routingProfilePromises: Connect.DescribeRoutingProfileResponse[] = await Promise.all(
      routingProfileSummaries.map(summary => {
        return SourceEnvConnect.describeRoutingProfile({
          InstanceId: instanceId,
          RoutingProfileId: summary?.Id as string
        }).promise();
      })
    );

    await Promise.all(routingProfilePromises);

    const routingProfiles: IRoutingProfile[]|{} = routingProfilePromises.map(profile => {
      console.log('profile:', profile);
      return {};
    });

    // const newRoutingProfile: IRoutingProfile = {
    //   name: RoutingProfile?.Name,
    //   defaultOutboundQueueId: RoutingProfile?.DefaultOutboundQueueId,
    //   description: RoutingProfile?.Description,
    //   mediaConcurrencies: RoutingProfile?.MediaConcurrencies
    // };

  //   {
  //     "RoutingProfile": {
  //         "InstanceId": "2c0e519a-a65c-455b-836b-dd2d3fa07b32",
  //         "Name": "Sales",
  //         "RoutingProfileArn": "arn:aws:connect:us-east-1:521208942562:instance/2c0e519a-a65c-455b-836b-dd2d3fa07b32/routing-profile/15b72e69-5c52-4e7d-b15c-4676a60a3d29",
  //         "RoutingProfileId": "15b72e69-5c52-4e7d-b15c-4676a60a3d29",
  //         "Description": "Sales routing profile",
  //         "MediaConcurrencies": [
  //             {
  //                 "Channel": "CHAT",
  //                 "Concurrency": 1
  //             },
  //             {
  //                 "Channel": "TASK",
  //                 "Concurrency": 1
  //             },
  //             {
  //                 "Channel": "VOICE",
  //                 "Concurrency": 1
  //             }
  //         ],
  //         "DefaultOutboundQueueId": "77e01463-dfc5-4f40-a8ad-6638684b03e0",
  //         "Tags": {}
  //     }
  // }

  }

  // TODO: promoteContactFlow
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

  private async assumeDestinationRole(roleArn: string, deployProfile: string): Promise<STS.Credentials> {
    const {Credentials} = await AwsSTS.assumeRole({
      RoleArn: roleArn,
      RoleSessionName: deployProfile // TODO: discuss naming this
    }).promise();

    return Credentials as STS.Credentials;
  }

  private validateEnvVars() {
    const unsetEnvVars: string[] = [];
    if(!process.env['AWS_PROFILE']) unsetEnvVars.push('AWS_PROFILE');
    if(!process.env['SOURCE_REGION']) unsetEnvVars.push('SOURCE_REGION');
    if(unsetEnvVars.length > 0) throw new Error(`The following environment variables must be set:\n${unsetEnvVars.join(' ')}`);
  }
}