import { VFConnect } from './connect';

(async () => {
  const unsetEnvVars: string[] = [];
  // if(!process.env['AWS_PROFILE']) unsetEnvVars.push('AWS_PROFILE');
  // if(!process.env['REGION']) unsetEnvVars.push('REGION');

  // if(unsetEnvVars.length > 0) throw new Error(`The following environment variables must be set:\n${unsetEnvVars.join(' ')}`);

  const krausTeam7InstanceId: string = '2c0e519a-a65c-455b-836b-dd2d3fa07b32';
  const krausConnectTestLambdaArn: string = 'arn:aws:lambda:us-east-1:521208942562:function:kraus-connect-test';
  const krausFooLambdaArn: string = 'arn:aws:lambda:us-east-1:521208942562:function:kraus-foo';
  const flowName: string = '_krausTest';
  
  const vfConnect = new VFConnect();
  // vfConnect.associateLambdas(
  //   [
  //   krausConnectTestLambdaArn,
  //   krausFooLambdaArn
  // ],
  // krausTeam7InstanceId);

  // console.log('Lambdas associated successfully');

  await vfConnect.promoteContactFlow(krausTeam7InstanceId, flowName);

  console.log('Script completed successfully.');
})();
