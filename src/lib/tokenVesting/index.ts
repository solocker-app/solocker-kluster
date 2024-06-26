import { PublicKey } from "@solana/web3.js";
import {
  getContractInfoByTokenAddress,
  TOKEN_VESTING_PROGRAM_ID,
} from "@solocker/vesting";

import Repository from "../repository";
import InjectRepository from "../injection";

export class TokenVesting extends InjectRepository {
  constructor(repository: Repository) {
    super(repository);
  }

  async getContractInfoByOwner(wallet: string, programId?: string) {
    programId = programId ?? TOKEN_VESTING_PROGRAM_ID.toBase58();

    const { connection, token, metaplex } = this.repository;
    const tokenAccounts = await token.getNormalTokenAccounts(wallet);
    const atas = tokenAccounts.map((tokenAccount) => tokenAccount.pubkey);

    let contractInfos = await Promise.all(
      atas.map((ata) => {
        return getContractInfoByTokenAddress(
          connection,
          new PublicKey(programId!),
          ata
        );
      })
    );

    return Promise.all(
      contractInfos.flat().map(async (contractInfo: any) => {
        contractInfo.seed = contractInfo.seeds.toString(undefined, 0, 31);
        delete contractInfo["seeds"];

        const mintMetadata = (await metaplex.fetchMetadata(
          contractInfo.mintAddress.toBase58()
        )) as any;

        const tokenAccount = tokenAccounts.find((tokenAccount) =>
          tokenAccount.pubkey.equals(contractInfo.destinationAddress)
        );
        mintMetadata.token = tokenAccount?.account.data.parsed.info;

        return {
          mintMetadata,
          contractInfo,
        };
      })
    );
  }

  async getLpContractInfoByOwner(wallet: string, programId?: string) {
    programId = programId ?? TOKEN_VESTING_PROGRAM_ID.toBase58();

    const { raydium, connection, token } = this.repository;
    const tokenAccounts = await token.getLpTokenAccounts(wallet);

    const lpInfos = await raydium.fetchTokenAccountsLpPoolInfo(tokenAccounts);
    const atas = lpInfos.map(
      (lpInfo) => new PublicKey(lpInfo.pubKey)
    );

    const contractInfos = await Promise.all(
      atas.map((ata) =>
        getContractInfoByTokenAddress(
          connection,
          new PublicKey(programId!),
          ata
        )
      )
    );

    return contractInfos.flat().map((contractInfo: any) => {
      const lpInfo = lpInfos.find(
        (lpInfo) =>
          contractInfo.mintAddress.toBase58() === lpInfo.lpTokenMetadata.mint
      )!;

      contractInfo.seed = contractInfo.seeds.toString(undefined, 0, 31);
      delete contractInfo["seeds"];

      return {
        lpInfo,
        contractInfo,
      };
    });
  }
}
