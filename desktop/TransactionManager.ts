import { BrowserWindow } from 'electron';
import { ipcConsts } from '../app/vars';
import StoreService from './storeService';
import cryptoService from './cryptoService';
import { fromHexString, toHexString } from './utils';

const DATA_BATCH = 50;

// const asyncForEach = async (array: Array<any>, callback: (obj: any, index: number, array: Array<any>) => void) => {
//   for (let index = 0; index < array.length; index += 1) {
//     await callback(array[index], index, array); // eslint-disable-line no-await-in-loop
//   }
// };

// const compare = (a: any, b: any) => {
//   if (!a.timestamp && !b.timestamp) {
//     return 0;
//   } else if (a.timestamp && !b.timestamp) {
//     return 1;
//   } else if (!a.timestamp && b.timestamp) {
//     return -1;
//   } else return b.timestamp - a.timestamp;
// };

class TransactionManager {
  private readonly meshService: any;

  private readonly glStateService: any;

  private readonly txService: any;

  accounts: any;

  private readonly mainWindow: BrowserWindow;

  constructor(meshService, glStateService, txService, mainWindow) {
    this.meshService = meshService;
    this.glStateService = glStateService;
    this.txService = txService;
    this.mainWindow = mainWindow;
  }

  appStateUpdater = ({ channel, data }: { channel: string; data: any }) => {
    this.mainWindow.webContents.send(channel, { data });
  };

  updateAppStateAccount = ({ accountId }) => {
    const account = StoreService.get(`accounts.${accountId}.account`);
    this.appStateUpdater({ channel: ipcConsts.T_M_UPDATE_ACCOUNT, data: account });
  };

  updateAppStateTxs = ({ accountId }: { accountId: string }) => {
    const txs = StoreService.get(`accounts.${accountId}.txs`);
    this.appStateUpdater({ channel: ipcConsts.T_M_UPDATE_TXS, data: txs });
  };

  updateAppStateRewards = ({ accountId }: { accountId: string }) => {
    const rewards = StoreService.get(`accounts.${accountId}.rewards`);
    this.appStateUpdater({ channel: ipcConsts.T_M_UPDATE_REWARDS, data: rewards });
  };

  setAccounts = ({ accounts }: { accounts: Array<any> }) => {
    this.accounts = accounts;
    accounts.forEach((account) => {
      const binaryAccountId = fromHexString(account.publicKey);
      const addTransaction = this.addTransaction({ accountId: account.publicKey });
      this.retrieveHistoricTxData({ accountId: binaryAccountId, offset: 0, handler: addTransaction, retries: 0 });
      this.meshService.activateAccountMeshDataStream({ accountId: binaryAccountId, handler: addTransaction });

      const accountDataFilter = { account_id: { address: binaryAccountId }, account_data_flags: 0 };
      const updateAccountData = this.updateAccountData({ accountId: account.publicKey });
      this.retrieveAccountData({ filter: accountDataFilter, handler: updateAccountData, retries: 0 });
      this.glStateService.activateAccountDataStream({ filter: accountDataFilter, handler: updateAccountData });

      const txReceiptsFilter = { account_id: { address: binaryAccountId }, account_data_flags: 1 };
      const addReceiptToTx = this.addReceiptToTx({ accountId: account.publicKey });
      this.retrieveHistoricTxReceipt({ filter: txReceiptsFilter, offset: 0, handler: addReceiptToTx, retries: 0 });
      this.glStateService.activateAccountDataStream({ filter: txReceiptsFilter, handler: addReceiptToTx });

      const rewardsFilter = { account_id: { address: binaryAccountId }, account_data_flags: 1 };
      this.retrieveRewards({ filter: rewardsFilter, offset: 0, handler: this.addReward, retries: 0 });
      this.glStateService.activateAccountDataStream({ filter: rewardsFilter, handler: this.addReward });
    });
  };

  addAccount = ({ account }: { account: any }) => {
    this.accounts.push(account);
    const binaryAccountId = fromHexString(account.publicKey);
    const addTransaction = this.addTransaction({ accountId: account.publicKey });
    this.meshService.activateAccountMeshDataStream({ accountId: binaryAccountId, handler: addTransaction });
    const addReceiptToTx = this.addReceiptToTx({ accountId: account.publicKey });
    const filter = { account_id: { address: binaryAccountId }, account_data_flags: 1 };
    this.glStateService.activateAccountDataStream({ filter, handler: addReceiptToTx });
  };

  addTransaction = ({ accountId }: { accountId: string }) => ({ tx }: { tx: any }) => {
    const txId = toHexString(tx.id.id);
    let existingTx = StoreService.get(`accounts.${accountId}.txs.${txId}`) || {};
    const newData = {
      txId,
      receiver: toHexString(tx.coin_transfer.receiver.address),
      sender: toHexString(tx.sender.address),
      gasProvided: parseInt(tx.gas_offered.gas_provided),
      gasPrice: parseInt(tx.gas_offered.gas_price),
      amount: parseInt(tx.amount.value),
      counter: parseInt(tx.counter),
      signature: {
        scheme: tx.signature.scheme,
        signature: toHexString(tx.signature.signature),
        publicKey: toHexString(tx.signature.public_key)
      }
    };
    existingTx = { ...existingTx, ...newData };
    StoreService.set({ accounts: { [accountId]: { txs: { [txId]: existingTx } } } });
    this.updateAppStateTxs({ accountId });
  };

  retrieveHistoricTxData = async ({ accountId, offset, handler, retries }: { accountId: Uint8Array; offset: number; handler: ({ tx }: { tx: any }) => void; retries: number }) => {
    const { data, totalResults, error } = await this.meshService.sendAccountMeshDataQuery({ accountId, offset });
    if (error && retries < 5) {
      await this.retrieveHistoricTxData({ accountId, offset, handler, retries: retries + 1 });
    } else {
      data.forEach((tx) => handler({ tx }));
      if (offset < totalResults) {
        await this.retrieveHistoricTxData({ accountId, offset: offset + DATA_BATCH, handler, retries: 0 });
      }
    }
  };

  updateAccountData = ({ accountId }: { accountId: string }) => ({ data }: { data: any }) => {
    const currentState = { counter: parseInt(data.state_current.counter), balance: parseInt(data.state_current.balance) };
    const projectedState = { counter: parseInt(data.state_projected.counter), balance: parseInt(data.state_projected.balance) };
    StoreService.set({ accounts: { [accountId]: { account: { currentState, projectedState } } } });
    this.updateAppStateAccount({ accountId });
  };

  retrieveAccountData = async ({ filter, handler, retries }: { filter: any; handler: ({ data }: { data: any }) => void; retries: number }) => {
    const { data, error } = await this.glStateService.sendAccountDataQuery({ filter, offset: 0 });
    if (error && retries < 5) {
      await this.retrieveAccountData({ filter, handler, retries: retries + 1 });
    } else {
      handler({ data: data[0].account_wrapper });
    }
  };

  addReceiptToTx = ({ accountId }: { accountId: string }) => ({ data }: { data: any }) => {
    const txId = toHexString(data.id.id);
    let existingTx = StoreService.get(`accounts.${accountId}.txs.${txId}`) || {};
    const newData = {
      txId,
      result: data.result,
      gasUsed: parseInt(data.gas_used),
      fee: parseInt(data.fee.value),
      layer: data.layer,
      index: data.index
    };
    existingTx = { ...existingTx, ...newData };
    StoreService.set({ accounts: { [accountId]: { txs: { [txId]: existingTx } } } });
    this.updateAppStateTxs({ accountId });
  };

  retrieveHistoricTxReceipt = async ({ filter, offset, handler, retries }: { filter: any; offset: number; handler: ({ data }: { data: any }) => void; retries: number }) => {
    const { totalResults, data, error } = await this.glStateService.sendAccountDataQuery({ filter, offset });
    if (error && retries < 5) {
      await this.retrieveHistoricTxReceipt({ filter, offset, handler, retries: retries + 1 });
    } else {
      data.forEach((item) => handler({ data: item.receipt }));
      if (offset < totalResults) {
        await this.retrieveHistoricTxReceipt({ filter, offset: offset + DATA_BATCH, handler, retries: 0 });
      }
    }
  };

  // TODO: reward by smesher id OR coinbase
  addReward = ({ data }: { data: any }) => {
    const coinbase = toHexString(data.coinbase.address);
    const reward = {
      layer: data.layer,
      total: parseInt(data.total.value),
      layerReward: parseInt(data.layer_reward.value),
      layerComputed: data.layer_computed,
      coinbase: `0x${coinbase}`,
      smesher: toHexString(data.smesher.id)
    };
    const rewards = StoreService.get(`accounts.${coinbase}.rewards`);
    StoreService.set({ accounts: { [coinbase]: { rewards: [...rewards, reward] } } });
    this.updateAppStateRewards({ accountId: coinbase });
  };

  retrieveRewards = async ({ filter, offset, handler, retries }: { filter: any; offset: number; handler: ({ data }: { data: any }) => void; retries: number }) => {
    const { totalResults, data, error } = await this.glStateService.sendAccountDataQuery({ filter, offset: 0 });
    if (error && retries < 5) {
      await this.retrieveRewards({ filter, offset, handler, retries: retries + 1 });
    } else {
      data.forEach((item) => handler({ data: item.reward }));
      if (offset < totalResults) {
        await this.retrieveRewards({ filter, offset, handler, retries: 0 });
      }
    }
  };

  sendTx = async ({ fullTx, accountIndex }: { fullTx: any; accountIndex: number }) => {
    try {
      const account = StoreService.get(`accounts.${this.accounts[accountIndex].publicKey}.account`);
      const { receiver, amount, fee } = fullTx;
      const res = await cryptoService.signTransaction({
        accountNonce: account.projectedState.counter,
        receiver,
        price: fee,
        amount,
        secretKey: this.accounts[accountIndex].secretKey
      });
      // @ts-ignore
      const { txstate } = await this.txService.submitTransaction({ transaction: res });
      const txId = toHexString(txstate.id.id);
      const txWithId = { txId, ...fullTx };
      if (![1, 2, 3].includes(txstate.state)) {
        StoreService.set({ accounts: { [this.accounts[accountIndex].publicKey]: { txs: { [txId]: txWithId } } } });
        this.updateAppStateTxs({ accountId: this.accounts[accountIndex].publicKey });
      }
      return { error: null, tx: txWithId, state: txstate.state };
    } catch (error) {
      return { error, tx: null, state: '' };
    }
  };

  updateTransaction = ({ newData, accountIndex, txId }: { newData: any; accountIndex: number; txId: string }) => {
    return txId ? this.updateTxNote({ newData, accountIndex, txId }) : this.updateTxContact({ newData, accountIndex });
  };

  updateTxNote = ({ newData, accountIndex, txId }: { newData: any; accountIndex: number; txId: string }) => {
    const tx = StoreService.get(`accounts.${this.accounts[accountIndex].publicKey}.txs.${txId}`);
    StoreService.set({ accounts: { [this.accounts[accountIndex].publicKey]: { txs: { [txId]: { ...tx, note: newData.note } } } } });
    this.updateAppStateTxs({ accountId: this.accounts[accountIndex].publicKey });
  };

  updateTxContact = ({ newData, accountIndex }: { newData: any; accountIndex: number }) => {
    const { address, nickname } = newData;
    const addrString = address.substring(2).toLowerCase();
    const txs = StoreService.get(`accounts.${this.accounts[accountIndex].publicKey}.txs.`);
    const updatedTxs = {};
    Object.keys(txs).forEach((key) => {
      updatedTxs[txs[key].txId] = txs[key];
      if (txs[key].sender === addrString || txs[key].receiver === addrString) {
        txs[key].nickname = nickname;
      }
    });
    StoreService.set({ accounts: { [this.accounts[accountIndex].publicKey]: { txs: updatedTxs } } });
    this.updateAppStateTxs({ accountId: this.accounts[accountIndex].publicKey });
  };
}

export default TransactionManager;