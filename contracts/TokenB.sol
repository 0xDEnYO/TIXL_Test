// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import './MyERC20.sol';

contract TokenB is MyERC20 {

constructor() {
    name = "Token B";
    symbol = "TKB";
    totalSupply = 10000000000000000000000000;
}

}