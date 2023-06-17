import fetch from 'node-fetch';
import https from 'https';

//var request = require("request"); 
import xml2js from 'xml2js';
var msg = "Hello Node.js World";
//console.log(msg);
var localIP = '192.168.xx.xx';  //this can be gotten from Homey's mDNS probe and is the local IP number of the Enphase Envoy-S/IQ Gateway
// replace '192.168.yy.yy' in this file with the ip-address of your Homey
// On Homey install the Virtual Devices app https://homey.app/en-us/app/com.arjankranenburg.virtual/Virtual-Devices/
// as well as the http flowcards app https://homey.app/en-ie/app/com.internet/HTTP-request-flow-cards/
// add a virtual device (device class "solar panel") with only "power" (for receiving "measure_power") capability for each microinverter, name it IQ8M_<serialnumber>
// where <serialnumber> is the serialnumber of the microinverter. 
// add 4 virtual devices (device class "sensor") with "power" and "power meter" (for receiving "measure_power" and "meter_power") capability for each of the Envoy meters
// name these "Envoy_Inverters_Production", "Envoy_Net_Consumption", "Envoy_Production", "Envoy_Total_Consumption"
// make a flow with a start-card (t30) "Incomming POST" with the token "EnvoyInverters"
// in that flow make a then card for each of the microinverters virtual devices "Set a virtual sensor value" with the sensor type "measure_power" and the value "{{(JSON.IQ8M_48********25/1)}}" the "JSON" part is a tag replace the serialnumber after "IQ8M_" with the exact serial number of the microinverter/virtual-device
// make for each of the Envoy meters 2 then cards as follows:
// "Set a virtual sensor value" with the sensor type "measure_power" and the value "{{(JSON.<virtual-device>/1)}}" the "JSON" part is a tag where <virtual-device> is to be Envoy meter.
// "Set a virtual sensor value" with the sensor type "meter_power" and the value "{{(JSON.<virtual-device>_Meter/1)}}" the "JSON" part is a tag where <virtual-device> is to be Envoy meter.
// 
var username = `email@example.com`;  //this is the e-mail for the Enphase Enligthen account
var password = 'suppersecret';  //this is the password for the Enphase Enlighten account
var infoxmlurlpath = '/info.xml';
//var infoxmlurl = 'http://'+localIP+infoxmlurlpath;
var enphaseenlightenurl = 'https://enlighten.enphaseenergy.com/login/login.json?';
var enphaseenlightenAuthtokenurl = 'https://entrez.enphaseenergy.com/tokens';
var authcheckurlpath = '/auth/check_jwt';
var productionurlpath = '/production.json';
var inverterurlpath = '/api/v1/production/inverters/'
var serialnumber = 'xxxx';
var softwareversion = 'xx.x.xxx';
var session_id = 'xxxx';
var localsession_id = 'xxxx';
var authtoken = '';
var authtoken_available = false;
var authtoken_valid = false;
var mostAncientInverterData = 0;
var mostAncientProductionData = 0;
var timeDifference = 0;
var intervalProduction = 15; //30; // Inverter count and watts updated every 30 seconds (1*60);
var intervalInverters = (5*60); //Individual Inverters are updated every 5 minutes (not in sync)
var sleepDuration = 5;
let invertersArray = [];
let productionArray = [];
var net_consumptionToday = 0;

async function addProductionDataToProductionArray(productionData_activeCount, productionData_type, productionData_readingTime, productionData_wNow, productionData_whLifetime){
    var productionIndex = productionArray.findIndex(production_item => production_item.type==productionData_type);
    if (productionIndex>-1){ //only update when this type exists
        if (productionArray[productionIndex].readingTime!=productionData_readingTime){ //only update when actual new reading
            productionArray[productionIndex].activeCount=productionData_activeCount; 
            productionArray[productionIndex].type=productionData_type;
            productionArray[productionIndex].readingTime=productionData_readingTime;
            productionArray[productionIndex].wNow=productionData_wNow;
            productionArray[productionIndex].whLifetime=productionData_whLifetime;
            //console.log("Measurement type: "+JSON.stringify(productionArray[productionIndex].type)+
            //            " ActiveCount: "+productionArray[productionIndex].activeCount+
            //            " ReadingTime: "+productionArray[productionIndex].readingTime+
            //            " Watt(now): "+productionArray[productionIndex].wNow+
            //            " Watt(Lifetime): "+productionArray[productionIndex].whLifetime);
            if (JSON.stringify(productionData_type).includes("inverters")){
                        const homeyDeviceName="Envoy_Inverters_Production";
                        const body = "{\""+homeyDeviceName+"\": "+productionData_wNow+
                                       ", \""+homeyDeviceName+"_Meter\": "+productionData_whLifetime+"}";
                        //console.log(body);
                        const response = await fetch('http://192.168.yy.yy/api/app/com.internet/EnvoyInverters', {
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: body
                        }); 
                        //console.log("post response: "+response.status);
                    }
                    if (JSON.stringify(productionData_type).includes("production")){
                        const homeyDeviceName="Envoy_Production";
                        const body = "{\""+homeyDeviceName+"\": "+productionData_wNow+
                                       ", \""+homeyDeviceName+"_Meter\": "+productionData_whLifetime+"}";
                        //console.log(body);
                        const response = await fetch('http://192.168.yy.yy/api/app/com.internet/EnvoyInverters', {
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: body
                        }); 
                        //console.log("post response: "+response.status);
                    }
                    if (JSON.stringify(productionData_type).includes("total-consumption")){
                        const homeyDeviceName="Envoy_Total_Consumption";
                        const body = "{\""+homeyDeviceName+"\": "+productionData_wNow+
                                       ", \""+homeyDeviceName+"_Meter\": "+productionData_whLifetime+"}";
                        //console.log(body);
                        const response = await fetch('http://192.168.yy.yy/api/app/com.internet/EnvoyInverters', {
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: body
                        }); 
                        //console.log("post response: "+response.status);
                    }
                    if (JSON.stringify(productionData_type).includes("net-consumption")){
                        const homeyDeviceName="Envoy_Net_Consumption";
                        const body = "{\""+homeyDeviceName+"\": "+productionData_wNow+
                                       ", \""+homeyDeviceName+"_Meter\": "+productionData_whLifetime+"}";
                        //console.log(body);
                        const response = await fetch('http://192.168.yy.yy/api/app/com.internet/EnvoyInverters', {
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: body
                        }); 
                        //console.log("post response: "+response.status);
                    }
        }
    } else { // add a new type to the productionArray
        let production_item = {
            "activeCount" : productionData_activeCount,
            "type" : productionData_type,
            "readingTime" : productionData_readingTime,
            "wNow" : productionData_wNow,
            "whLifetime" : productionData_whLifetime
        }
        productionArray.push(production_item);
        productionIndex= productionArray.length-1;
        //console.log("[New] Measurement type: "+JSON.stringify(productionArray[productionIndex].type)+
        //                " ActiveCount: "+productionArray[productionIndex].activeCount+
        //                " ReadingTime: "+productionArray[productionIndex].readingTime+
        //                " Watt(now): "+productionArray[productionIndex].wNow+
        //                " Watt(Lifetime): "+productionArray[productionIndex].whLifetime);

    }
}

async function addInverterDataToInvertersArray(inverterData_serialNumber,inverterData_lastReportDate,inverterData_lastReportWatts){
    var inverterIndex = invertersArray.findIndex(inverter => inverter.serialNumber==inverterData_serialNumber);
    if (inverterIndex>-1){  // only update when inverter serial number exists already
        if (invertersArray[inverterIndex].lastReportDate!=inverterData_lastReportDate){ // only update when reading is updated
            invertersArray[inverterIndex].lastReportDate=inverterData_lastReportDate;
            invertersArray[inverterIndex].lastReportWatts=inverterData_lastReportWatts;
            //console.log("Inverter: "+JSON.stringify(invertersArray[inverterIndex].serialNumber)+
            //            " LastReportDate: "+invertersArray[inverterIndex].lastReportDate+
            //            " Watts: "+inverterData_lastReportWatts);
            const homeyDeviceName="IQ8M_"+invertersArray[inverterIndex].serialNumber;
            const body = "{\""+homeyDeviceName+"\": "+inverterData_lastReportWatts+"}";
            //console.log(body);
            const response = await fetch('http://192.168.yy.yy/api/app/com.internet/EnvoyInverters', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: body
            }); 
            //console.log("post response: "+response.status);

    }
    } else { // add new inverter to the invertersArray
        let inverter = {
            "serialNumber" : inverterData_serialNumber,
            "lastReportDate"  : inverterData_lastReportDate,
            "lastReportWatts" : inverterData_lastReportWatts  
        }
        invertersArray.push(inverter);
        //console.log("[New] Inverter: "+JSON.stringify(inverter.serialNumber)+
        //" LastReportDate: "+inverter.lastReportDate+
        //" Watts: "+inverter.lastReportWatts);
        const homeyDeviceName="IQ8M_"+inverterData_serialNumber;
        const body = "{\""+homeyDeviceName+"\": "+inverter.lastReportWatts+"}";
        //console.log(body);
        // const responsewithauthtoken = await fetch('http://192.168.yy.yy/api/app/com.internet/EnvoyInverters', {
        //     method: 'POST', 
        //     headers: {'Content-Type': 'application/json'}, 
        //     body: body
        // });

        
    }
}


async function getEnvoyFirmwareVersion(address){
    var infoxmlurl = 'http://'+address+infoxmlurlpath;

    const response = await fetch(infoxmlurl);
    const body = await response.text();
    //console.log(body);
    xml2js.parseString(body,(err, result) => {
        if (err) {
            console.log("error parsing xml to json");
            // return ("Error parsing info.XML");
            // return new Promise("Error parsing info.XML");
        } else {
            serialnumber = result.envoy_info.device[0]["sn"].toString();
            console.log("Serial number is: "+serialnumber);
            softwareversion = result.envoy_info.device[0]["software"];
            console.log("Software version is: "+softwareversion);
            timeDifference=(result.envoy_info.time-(Math.round(Date.now() / 1000)));
            console.log("time difference: "+timeDifference)

            // return new Promise(resolve => {resolve(softwareversion)});
        }
    });
    
};

async function getAuthToken(){
    const params = new URLSearchParams();
    params.append('user[email]',username);
    params.append('user[password]',password);

    //console.log("url ="+enphaseenlightenurl);
    //console.log("json params ="+params);
    const responsewithsessionid = await fetch(enphaseenlightenurl, {method: 'POST', body: params});
    const loginresponse = await responsewithsessionid.json();
    //console.log(loginresponse);
    if(loginresponse.message.includes("success")){
        console.log("We got a success on getting the session_id which is: "+loginresponse.session_id);
        session_id = loginresponse.session_id;
        // Now getting autorization token
        // const gettokenparams = new URLSearchParams();
        // gettokenparams.append('session_id',session_id);
        // gettokenparams.append('serial_num',serialnumber);
        // gettokenparams.append('username',username);
        // console.log("json gettokenparams ="+gettokenparams);
        const body = {
            'session_id': session_id,
            'serial_num': serialnumber,
            'username': username
            };
        //console.log(body);
        const responsewithauthtoken = await fetch(enphaseenlightenAuthtokenurl, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(body)
        });
        authtoken = await responsewithauthtoken.text();
        console.log("We got an AuthToken from Enphase");
        //console.log("The authtoken we got is: "+authtoken);
        authtoken_available=true;
    }else {
        console.log("We did not succeed in getting a session_id the message was: "+loginresponse.message);
        authtoken_available=false;
    }
}

async function checkAuthToken(){
    // Validate token (in case the token has expired)
    // authtoken='gobledigook';  // test to see if invalid authtoken is detected
    //if (authtoken_available==true){
        // there appears to be a token
        // check if token is valid

        //allow for selfsigned certificates
        const agent = new https.Agent({
            rejectUnauthorized: false
        })

        const checktokenresponse = await fetch('https://'+localIP+authcheckurlpath, { agent,
            method: 'GET',
            headers: {'Authorization': 'Bearer ' + authtoken},
        });
        const checkresult = await checktokenresponse.text();
        const cookies=checktokenresponse.headers.raw()['set-cookie'];
        const cookiestext=cookies.toString();
        //console.log(cookiestext);
        //console.log(checkresult);
        if (checkresult.includes("Valid token.")) {
            //console.log("Authtoken is valid");
            const session_id_text_index = cookiestext.indexOf('sessionId=');
            //console.log(cookiestext);
            //console.log(session_id_text_index);
            const session_id_text_start = cookiestext.substring(session_id_text_index+('sessionId=').length,cookiestext.length-('sessionId=').length);
            //console.log(session_id_text_start)
            const session_id_end_index = session_id_text_start.indexOf(';');
            //console.log(session_id_end_index);
            localsession_id=session_id_text_start.substring(0,session_id_end_index);
            //console.log(localsession_id);
            //console.log("Local Session ID is: "+localsession_id);
            authtoken_valid=true;
        } else {
            console.log("Authtoken is NOT valid");
            authtoken_valid=false;
        }

}

async function getProductionAndConsumption(){
    //allow for selfsigned certificates
    const agent = new https.Agent({
        rejectUnauthorized: false
    })
    mostAncientProductionData = (Math.round(Date.now() / 1000));
    const productionresponse = await fetch('https://'+localIP+productionurlpath, { agent,
    method: 'GET',
    headers: {cookie: 'sessionId='+localsession_id},
    });
    net_consumptionToday=0; //reset value
    // const productionresponse_text = await productionresponse.text();
    // console.log(productionresponse_text);
    const productionresponse_json = await productionresponse.json();
    //console.log(productionresponse_json);
    //console.log(productionresponse_json.production);
    for (const index in productionresponse_json.production){
        if (productionresponse_json.production[index].activeCount>0){ //only use readingTime of active items
            if ((productionresponse_json.production[index].readingTime)<mostAncientProductionData){ //only set to the lowest readingTime
                mostAncientProductionData = productionresponse_json.production[index].readingTime;
            }
        }
        // if (index==0){ //note that in my experience all production, total-consumption, net-consumption readings are done at the same time
        //     //mostAncientProductionData = productionresponse_json.production[index].readingTime;
        // } else {
        //     if ((productionresponse_json.production[index].readingTime)<mostAncientProductionData){
        //         //mostAncientProductionData=productionresponse_json.production[index].readingTime;
        //     }
        // }
        //console.log("production_item: "+JSON.stringify(productionresponse_json.production[index]));
        if (JSON.stringify(productionresponse_json.production[index].type).includes("inverters")){
            addProductionDataToProductionArray(productionresponse_json.production[index].activeCount, 
                                               productionresponse_json.production[index].type, 
                                               productionresponse_json.production[index].readingTime, 
                                               productionresponse_json.production[index].wNow, 
                                               productionresponse_json.production[index].whLifetime);
            //console.log("Number of inverters: "+productionresponse_json.production[index].activeCount);
        }
        if (JSON.stringify(productionresponse_json.production[index].type).includes("eim")){
            //console.log("ActiveCount: "+productionresponse_json.production[index].activeCount);
            addProductionDataToProductionArray(productionresponse_json.production[index].activeCount, 
                productionresponse_json.production[index].measurementType, 
                productionresponse_json.production[index].readingTime, 
                productionresponse_json.production[index].wNow, 
                productionresponse_json.production[index].whLifetime);

            // if ((productionresponse_json.production[index].activeCount)>0){
            //     console.log("measurementType: ",JSON.stringify(productionresponse_json.production[index].measurementType)+
            //     " current Watt: ",JSON.stringify(productionresponse_json.production[index].wNow)+
            //     " whLifetime: ",JSON.stringify(productionresponse_json.production[index].whLifetime));
            // }
            if (JSON.stringify(productionresponse_json.production[index].measurementType).includes("production")){
                net_consumptionToday=-productionresponse_json.production[index].whToday;
            }
        }
    }
    //console.log("next part");
    //console.log(productionresponse_json.consumption);
    for (const index in productionresponse_json.consumption){
        if (productionresponse_json.consumption[index].activeCount>0){ //only use readingTime of active items
            if ((productionresponse_json.consumption[index].readingTime)<mostAncientProductionData){ //only set to the lowest readingTime
                mostAncientProductionData = productionresponse_json.consumption[index].readingTime;
            }
        }
        if (JSON.stringify(productionresponse_json.consumption[index].type).includes("eim")){
            //console.log("ActiveCount: "+productionresponse_json.consumption[index].activeCount);
            addProductionDataToProductionArray(productionresponse_json.consumption[index].activeCount, 
                productionresponse_json.consumption[index].measurementType, 
                productionresponse_json.consumption[index].readingTime, 
                productionresponse_json.consumption[index].wNow, 
                productionresponse_json.consumption[index].whLifetime);
            // if ((productionresponse_json.consumption[index].activeCount)>0){
            //     console.log("measurementType: ",JSON.stringify(productionresponse_json.consumption[index].measurementType)+
            //     " current Watt: ",JSON.stringify(productionresponse_json.consumption[index].wNow)+
            //     " whLifetime: ",JSON.stringify(productionresponse_json.consumption[index].whLifetime));
            // }
            if (JSON.stringify(productionresponse_json.consumption[index].measurementType).includes("total-consumption")){
                net_consumptionToday=net_consumptionToday+productionresponse_json.consumption[index].whToday;
            }
        }
        
    }
    //console.log("next part");
    //console.log(productionresponse_json.storage);

    for (const index in productionresponse_json.storage){ // i don't have access to a storage device (i.e. Enphase battery) so i don't know what the json objects mean precisely
        if (productionresponse_json.storage[index].activeCount>0){ //only use readingTime of active items
            if ((productionresponse_json.storage[index].readingTime)<mostAncientProductionData){ //only set to the lowest readingTime
                mostAncientProductionData = productionresponse_json.storage[index].readingTime;
            }
        }
        if (index==0){ //note that in my experience all production, total-consumption, net-consumption readings are done at the same time
            //mostAncientProductionData = productionresponse_json.storage[index].readingTime;
        } else {
            if ((productionresponse_json.storage[index].readingTime)<mostAncientProductionData){
                //mostAncientProductionData=productionresponse_json.storage[index].readingTime;
            }
        }
        //console.log("production_item: "+JSON.stringify(productionresponse_json.storage[index]));
        if (JSON.stringify(productionresponse_json.storage[index].type).includes("acb")){
            addProductionDataToProductionArray(productionresponse_json.storage[index].activeCount, 
                                               productionresponse_json.storage[index].type, 
                                               productionresponse_json.storage[index].readingTime, 
                                               productionresponse_json.storage[index].wNow, 
                                               productionresponse_json.storage[index].whNow);
            //console.log("Number of inverters: "+productionresponse_json.storage[index].activeCount);
        }
    }
    //console.log("Number of inverters: "+productionresponse_json.production[0].type);
    //console.log("Net-consumption today (Wh): "+net_consumptionToday);
    const secondsBeforeNewData = ((mostAncientProductionData+(intervalProduction))-(Math.round(Date.now() / 1000)));
    //console.log("No new data expected from Production for another: "+secondsBeforeNewData+" seconds");

}

async function getInverterData(){
    const timeOfReport=(Math.round(Date.now() / 1000));

    if ((mostAncientInverterData+(intervalInverters))<=timeOfReport){
        //most recent Invertaer data was dated more than intervalInverters seconds ago
        //allow for selfsigned certificates
        const agent = new https.Agent({
            rejectUnauthorized: false
        })
        
        const inverterresponse = await fetch('https://'+localIP+inverterurlpath, { agent,
            method: 'GET',
            headers: {cookie: 'sessionId='+localsession_id},
        });
        // const inverterresponse_text = await inverterresponse.text();
        // console.log(inverterresponse_text);
        const inverterresponse_json = await inverterresponse.json();
        //console.log(inverterresponse_json);
        for (const index in inverterresponse_json){
            const lastReportAge=timeOfReport-inverterresponse_json[index].lastReportDate;
            // console.log("Inverter: "+JSON.stringify(inverterresponse_json[index].serialNumber)+
            //             " LastReportAge(sec): "+lastReportAge+
            //             " Watts: "+inverterresponse_json[index].lastReportWatts);
            await addInverterDataToInvertersArray(inverterresponse_json[index].serialNumber, 
                                                   inverterresponse_json[index].lastReportDate,
                                                   inverterresponse_json[index].lastReportWatts);
            if (index==0){
                mostAncientInverterData=inverterresponse_json[index].lastReportDate;
            } else {
                if ((inverterresponse_json[index].lastReportDate)<mostAncientInverterData){
                    mostAncientInverterData=inverterresponse_json[index].lastReportDate;
                }
            }
        }
    } else {
        // const secondsBeforeNewData = ((mostAncientInverterData+(intervalInverters))-(Math.round(Date.now() / 1000)));
        // console.log("No new data expected from Inverters for another: "+secondsBeforeNewData+" seconds");
    }
    const secondsBeforeNewData = ((mostAncientInverterData+(intervalInverters))-(Math.round(Date.now() / 1000)));
    // console.log("No new data expected from Inverters for another: "+secondsBeforeNewData+" seconds");
   
}

//function sleep(milliseconds) {
//    const date = Date.now();
//    let currentDate = null;
//    do {
//      currentDate = Date.now();
//    } while (currentDate - date < milliseconds);
//  }
  
const sleep = async (milliseconds) => {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
}


// == this part is moved to athe async function "getEnvoyFirmwareVersion" ==//
// const response = await fetch(infoxmlurl);
// const body = await response.text();
// //console.log(body);  //debugging info
// xml2js.parseString(body,(err, result) => {
//     if (err) {
//         console.log("error parsing xml to json");
//     } else {
//         serialnumber = result.envoy_info.device[0]["sn"].toString();
//         console.log("Serial number is: "+serialnumber);
//         softwareversion = result.envoy_info.device[0]["software"];
//         console.log("Software version is: "+softwareversion);
//     }
// });
    
/*const functionresult =*/  await getEnvoyFirmwareVersion(localIP);
//console.log("functionresult: "+functionresult);

// mostAncientProductionData = (Math.round(Date.now() / 1000)-60*60); // set starting value to 1 hour (60*60 seconds) ago
//console.log(JSON.stringify(softwareversion).includes("D7."));
if (JSON.stringify(softwareversion).includes("D7.")) {
    console.log("We support this software version");

    // == this part is moved to athe async function "getAuthToken()" ==//

    // const params = new URLSearchParams();
    // params.append('user[email]',username);
    // params.append('user[password]',password);

    // //console.log("url ="+enphaseenlightenurl);
    // //console.log("json params ="+params);
    // const responsewithsessionid = await fetch(enphaseenlightenurl, {method: 'POST', body: params});
    // const loginresponse = await responsewithsessionid.json();
    // //console.log(loginresponse);
    // if(loginresponse.message.includes("success")){
    //     console.log("We got a success on getting the session_id which is: "+loginresponse.session_id);
    //     session_id = loginresponse.session_id;
    //     // Now getting autorization token
    //     // const gettokenparams = new URLSearchParams();
    //     // gettokenparams.append('session_id',session_id);
    //     // gettokenparams.append('serial_num',serialnumber);
    //     // gettokenparams.append('username',username);
    //     // console.log("json gettokenparams ="+gettokenparams);
    //     const body = {
    //         'session_id': session_id,
    //         'serial_num': serialnumber,
    //         'username': username
    //         };
    //     //console.log(body);
    //     const responsewithauthtoken = await fetch(enphaseenlightenAuthtokenurl, {
    //         method: 'POST', 
    //         headers: {'Content-Type': 'application/json'}, 
    //         body: JSON.stringify(body)
    //     });
    //     authtoken = await responsewithauthtoken.text();
    //     console.log("We got an AuthToken from Enphase");
    //     //console.log("The authtoken we got is: "+authtoken);

    await getAuthToken();

    for (let loopindex = 0; loopindex<100000000; loopindex++){

        // Validate token (in case the token has expired)
        // authtoken='gobledigook';  // test to see if invalid authtoken is detected
        if (authtoken_available==true){
            // there appears to be a token
            
            // == this part is moved to athe async function "getAuthToken()" ==//

            // // check if token is valid

            // //allow for selfsigned certificates
            // const agent = new https.Agent({
            //   rejectUnauthorized: false
            // })

            // const checktokenresponse = await fetch('https://'+localIP+authcheckurlpath, { agent,
            //     method: 'GET',
            //     headers: {'Authorization': 'Bearer ' + authtoken},
            // });
            // const checkresult = await checktokenresponse.text();
            // const cookies=checktokenresponse.headers.raw()['set-cookie'];
            // const cookiestext=cookies.toString();
            // //console.log(cookiestext);
            // //console.log(checkresult);
            // if (checkresult.includes("Valid token.")) {
            //     console.log("Authtoken is valid");
            // const session_id_text_index = cookiestext.indexOf('sessionId=');
            // //console.log(cookiestext);
            // //console.log(session_id_text_index);
            // const session_id_text_start = cookiestext.substring(session_id_text_index+('sessionId=').length,cookiestext.length-('sessionId=').length);
            // //console.log(session_id_text_start)
            // const session_id_end_index = session_id_text_start.indexOf(';');
            // //console.log(session_id_end_index);
            // localsession_id=session_id_text_start.substring(0,session_id_end_index);
            // //console.log(localsession_id);
            // console.log("Local Session ID is: "+localsession_id);

            if (((mostAncientProductionData+(intervalProduction))<=(Math.round(Date.now() / 1000))) || ((mostAncientInverterData+(intervalInverters))<=(Math.round(Date.now() / 1000)))){
                //most ancient Production data was dated more than intervalproduction seconds ago or most ancient Inverter data was dated more than intervalInverters seconds ago 
                await checkAuthToken();
                if (authtoken_valid==true){

                    // == this part is moved to athe async function "getProductionAndConsumption()" ==//

                    // //allow for selfsigned certificates
                    // const agent = new https.Agent({
                    //     rejectUnauthorized: false
                    // })

                    // const productionresponse = await fetch('https://'+localIP+productionurlpath, { agent,
                    //     method: 'GET',
                    //     headers: {cookie: 'sessionId='+localsession_id},
                    // });
                    // // const productionresponse_text = await productionresponse.text();
                    // // console.log(productionresponse_text);
                    // const productionresponse_json = await productionresponse.json();
                    // //console.log(productionresponse_json);
                    // //console.log(productionresponse_json.production);
                    // for (const index in productionresponse_json.production){
                    //     //console.log("production_item: "+JSON.stringify(productionresponse_json.production[index]));
                    //     if (JSON.stringify(productionresponse_json.production[index].type).includes("inverters")){
                    //         console.log("Number of inverters: "+productionresponse_json.production[index].activeCount);
                    //     }
                    //     if (JSON.stringify(productionresponse_json.production[index].type).includes("eim")){
                    //         //console.log("ActiveCount: "+productionresponse_json.production[index].activeCount);
                    //         if ((productionresponse_json.production[index].activeCount)>0){
                    //             console.log("measurementType: ",JSON.stringify(productionresponse_json.production[index].measurementType)+
                    //             " current Watt: ",JSON.stringify(productionresponse_json.production[index].wNow)+
                    //             " whLifetime: ",JSON.stringify(productionresponse_json.production[index].whLifetime));
                                
                    //         }
                    //     }
                    // }
                    // //console.log("next part");
                    // //console.log(productionresponse_json.consumption);
                    // for (const index in productionresponse_json.consumption){
                    //     if (JSON.stringify(productionresponse_json.consumption[index].type).includes("eim")){
                    //         //console.log("ActiveCount: "+productionresponse_json.consumption[index].activeCount);
                    //         if ((productionresponse_json.consumption[index].activeCount)>0){
                    //             console.log("measurementType: ",JSON.stringify(productionresponse_json.consumption[index].measurementType)+
                    //             " current Watt: ",JSON.stringify(productionresponse_json.consumption[index].wNow)+
                    //             " whLifetime: ",JSON.stringify(productionresponse_json.consumption[index].whLifetime));
                                
                    //         }
                    //      }
                        
                    // }
                    // //console.log("Number of inverters: "+productionresponse_json.production[0].type);

                    if ((mostAncientProductionData+(intervalProduction))<=(Math.round(Date.now() / 1000))){
                        //most recent Production data was dated more than intervalProduction seconds ago
                        await getProductionAndConsumption();
                    } else {
                        // no new data expected yet
                    }
                    

                    // == this part is moved to athe async function "getInverterData()" ==//

                    // const inverterresponse = await fetch('https://'+localIP+inverterurlpath, { agent,
                    //     method: 'GET',
                    //     headers: {cookie: 'sessionId='+localsession_id},
                    // });
                    // //const inverterresponse_text = await inverterresponse.text();
                    // //console.log(inverterresponse_text);
                    // const inverterresponse_json = await inverterresponse.json();
                    // //console.log(inverterresponse_json);
                    // for (const index in inverterresponse_json){
                    //     console.log("Inverter: "+JSON.stringify(inverterresponse_json[index].serialNumber)+" Watts: "+inverterresponse_json[index].lastReportWatts)
                    // }
                    if ((mostAncientInverterData+(intervalInverters))<=(Math.round(Date.now() / 1000))){
                        //most recent Inverter data was dated more than intervalInverters seconds ago
                        await getInverterData();
                    } else {
                        // no new data expected yet
                    }
                }else {
                    console.log("Authtoken is not valid");
                    console.log("attempting to get a new authtoken");
                    await getAuthToken();

                };
            } else {
            // no new data expected yet
                //console.log("nothing to get yet");
            }

        }
        //sleep(sleepDuration*1000);
	await sleep(sleepDuration*1000);
    } /*else {
        console.log("We did not succeed in getting a session_id the message was: "+loginresponse.message);
    }*/

} else {
    console.log("We DO NOT support this software version");
}



