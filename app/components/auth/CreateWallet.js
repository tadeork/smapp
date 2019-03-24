// @flow
import React, { Component } from 'react';
import styled from 'styled-components';
import { connect } from 'react-redux';
import { deriveEncryptionKey, saveNewWallet } from '/redux/wallet/actions';
import { SmButton, SmInput, Loader } from '/basicComponents';
import { miner } from '/assets/images';
import { smColors } from '/vars';
import type { Action } from '/types';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: space-between;
  padding: 30px;
`;

const UpperPart = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
`;

const BottomPart = styled.div`
  display: flex;
  flex-direction: column;
`;

const GrayText = styled.span`
  font-size: 16px;
  text-align: left;
  color: ${smColors.gray};
`;

const UpperPartHeader = styled.span`
  font-size: 24px;
  text-align: left;
  color: ${smColors.black};
`;

const Link = styled(GrayText)`
  font-size: 16px;
  text-align: left;
  color: ${smColors.green};
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    opacity: 0.6;
  }
`;

const ImageWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const Image = styled.img`
  max-width: 120px;
  max-height: 100%;
`;

const LoaderWrapper = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

type Props = {
  deriveEncryptionKey: Action,
  saveNewWallet: Action,
  navigateToLocalNodeSetup: Function,
  navigateToWallet: Function
};

type State = {
  subMode: 1 | 2,
  passphrase: string,
  verifiedPinCode: string,
  hasPinCodeError: boolean,
  hasVerifyPinCodeError: boolean,
  isLoaderVisible: boolean
};

class CreateWallet extends Component<Props, State> {
  state = {
    subMode: 1,
    passphrase: '',
    verifiedPinCode: '',
    hasPinCodeError: false,
    hasVerifyPinCodeError: false,
    isLoaderVisible: false
  };

  render() {
    const { isLoaderVisible, subMode } = this.state;
    if (isLoaderVisible) {
      return (
        <LoaderWrapper>
          <Loader size={Loader.sizes.BIG} />
        </LoaderWrapper>
      );
    }
    return subMode === 1 ? this.renderSubStep1() : this.renderSubStep2();
  }

  renderSubStep1 = () => {
    const { hasPinCodeError, hasVerifyPinCodeError } = this.state;
    return (
      <Wrapper>
        <UpperPart>
          <UpperPartHeader>Encrypt your Wallet</UpperPartHeader>
          <GrayText>Must be at least 8 characters</GrayText>
          <SmInput type="password" placeholder="Type password" hasError={hasPinCodeError} onChange={this.handlePasswordTyping} hasDebounce />
          <SmInput type="password" placeholder="Verify password" hasError={hasVerifyPinCodeError} onChange={this.handlePasswordVerifyTyping} hasDebounce />
          <GrayText>
            Your Wallet file is encrypted and saved on your computer. <Link>Show me the file</Link>
          </GrayText>
        </UpperPart>
        <BottomPart>
          <SmButton text="Next" theme="orange" onPress={this.createWallet} style={{ marginTop: 20 }} />
        </BottomPart>
      </Wrapper>
    );
  };

  renderSubStep2 = () => {
    const { navigateToLocalNodeSetup, navigateToWallet } = this.props;
    return (
      <Wrapper>
        <UpperPart>
          <UpperPartHeader>Setup a Spacemesh Local Node and start earning Spacemesh Coins?</UpperPartHeader>
          <ImageWrapper>
            <Image src={miner} />
          </ImageWrapper>
          <Link>Learn more about Spacemesh local nodes.</Link>
        </UpperPart>
        <BottomPart>
          <SmButton text="Yes, Setup Local Node" theme="orange" onPress={navigateToLocalNodeSetup} style={{ marginTop: 20 }} />
          <SmButton text="Maybe Later" theme="green" onPress={navigateToWallet} style={{ marginTop: 20 }} />
        </BottomPart>
      </Wrapper>
    );
  };

  handlePasswordTyping = ({ value }: { value: string }) => {
    this.setState({ passphrase: value, hasPinCodeError: false });
  };

  handlePasswordVerifyTyping = ({ value }: { value: string }) => {
    this.setState({ verifiedPinCode: value, hasVerifyPinCodeError: false });
  };

  validate = () => {
    const { passphrase, verifiedPinCode } = this.state;
    const hasPinCodeError = !passphrase || (!!passphrase && passphrase.length < 8);
    const hasVerifyPinCodeError = !verifiedPinCode || passphrase !== verifiedPinCode;
    this.setState({ hasPinCodeError, hasVerifyPinCodeError });
    return !hasPinCodeError && !hasVerifyPinCodeError;
  };

  createWallet = () => {
    const { deriveEncryptionKey, saveNewWallet } = this.props;
    const { passphrase, isLoaderVisible } = this.state;
    const canProceed = this.validate();
    if (canProceed && !isLoaderVisible) {
      this.setState({ isLoaderVisible: true });
      setTimeout(() => {
        deriveEncryptionKey({ passphrase });
        saveNewWallet({});
        this.setState({ isLoaderVisible: false, subMode: 2 });
      }, 500);
    }
  };
}

const mapDispatchToProps = {
  deriveEncryptionKey,
  saveNewWallet
};

CreateWallet = connect(
  null,
  mapDispatchToProps
)(CreateWallet);

export default CreateWallet;
