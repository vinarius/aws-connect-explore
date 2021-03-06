import { VFConnect } from './connect';

(async () => {
  const krausTeam7InstanceId: string = '2c0e519a-a65c-455b-836b-dd2d3fa07b32';
  const krausTeam9InstanceId: string = 'c9b5b732-1aba-4ca3-8ecb-b1d52efad33b';
  const krausFooLambdaArn: string = 'arn:aws:lambda:us-east-1:521208942562:function:kraus-team7-foo';
  const krausBarLambdaArn: string = 'arn:aws:lambda:us-east-1:521208942562:function:kraus-team7-bar';
  const lambdaNames: string[] = ['kraus-team7-foo', 'kraus-team7-bar']
  const flowName: string = '_krausTest';
  const flowName2: string = '_krausTest2';
  const flowNames = [flowName, flowName2];
  const assumeRoleArn = 'arn:aws:iam::538718130184:role/kraus-test-cross-account';
  
  const vfConnect = new VFConnect();
  // await vfConnect.associateLambdas({
  //   assumeRoleArn,
  //   inputLambdaNames: lambdaNames,
  //   destinationInstanceId: krausTeam9InstanceId,
  //   profile: process.env['AWS_PROFILE'] as string,
  //   destinationRegion: process.env['DESTINATION_REGION'] as string
  // });

  await vfConnect.getRoutingProfiles({
    instanceId: krausTeam7InstanceId
  });

  // await vfConnect.promoteContactFlow(
  //   {
  //     sourceInstanceId: krausTeam7InstanceId,
  //     destinationInstanceId: krausTeam9InstanceId,
  //     assumeRoleArn: 'arn:aws:iam::538718130184:role/kraus-test-cross-account',
  //     flowNames,
  //   }
  // );

  console.log('Script completed successfully.');
})();
