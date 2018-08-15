"use strict";
const express = require('express');
var mongoose = require('mongoose');
var ejs = require('ejs');
var path = require('path');
var bodyParser = require('body-parser');
var scrapy = require('node-scrapy');
var google = require('google');
const fs = require('fs');
var tts = require('./voice-rss-tts/index.js');

var request = require('request');


google.resultsPerPage = 10;

const app = express();

// mongoose.connect('mongodb://localhost:27017/university', function(err){
//     if (err) throw err
//   else console.log("connected to mongodb"); 
// });



app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser()); // pull information from html in POST
app.use('/public',express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});
app.post('/summarize', (req, res) => {
   
    var title = req.body.title;
    google(title, function (err, response){
        if (err) {
           console.error(err);
           res.render('not-found');
        }
        else{
            // console.log(response.links);
            var url = null;
            for(var j=0; j<response.links.length; j++){
                if(response.links[j].href != null){
                    if(response.links[j].href.includes('wiki')){
                        url = response.links[j].href;
                        break;
                    }
                    if(url == null)
                        url = response.links[j].href;
                } 
            }

            console.log(url);
            var selector = 'p';
            var read_text =  '';
       
            scrapy.scrape(url, selector, function(err, data) {
                if (err) return console.error(err)
                    if(data != null){
                        // for(var i = 0 ; i < data.length ; i++){
                        //     if(i < 10){
                        //         read_text = read_text + ' ' + data[i];
                        //     }
                                
                        // }
                        read_text=data.toString();
                        read_text = read_text.replace(/\[(.+?)\]/g, "");
                        
                        // console.log(data.length);
                        request.post({
                            url: 'https://api.deepai.org/api/summarization',
                            headers: {
                                'Api-Key': '1954524e-3b06-48a7-8ba2-08b1a2acd2f3'
                            },
                            formData: {
                                'text': read_text,
                            }
                          }, function callback(err, httpResponse, body) {
                            if (err) {
                                console.error('request failed:', err);
                                return;
                            }
                            var response = JSON.parse(body);
                            // console.log(response);
                            
                            const text = process.argv[2] || response.output;
                            text.replace('\n', '');
                            // console.log(text);
                            var fileName = title + '-' + Date.now() +'.mp3';
                            const outputFile = process.argv[3] || __dirname + '\\public\\' + fileName;
                            // const options = {
                            //     // url: `http://localhost:59125/process?INPUT_TEXT=${text}!&INPUT_TYPE=TEXT&OUTPUT_TYPE=AUDIO&AUDIO=WAVE_FILE&LOCALE=en_US&VOICE=cmu-slt-hsmm`,
                            //     url: 'http://api.voicerss.org/?key=f0a9e4e47788422299142c66046d0540&hl=en-us&src=' + text,
                            //     encoding: null // Binary data.
                            // }

                            console.log('Synthesizing speech ');
                            // console.log('Calling: ', options.url);
                            tts.speech({
                                key: 'f0a9e4e47788422299142c66046d0540',
                                hl: 'en-us',
                                src: text,
                                r: 0,
                                c: 'mp3',
                                f: '44khz_16bit_stereo',
                                ssml: false,
                                b64: false,
                                callback: function (error, content) {
                                    // response.end(error || content);
                                    console.log(content);
                                    fs.writeFileSync(outputFile,  content);
                                    console.log('File Save as ', fileName);
                                    res.render('summary', {selector: fileName, title: title, text: text , content: content});

                                }
                            });
                            // request.get(options, function (err, resp, data) {
                            //     if (err || resp.statusCode != 200) {
                            //         console.log(err);
                            //     } else {
                            //         try {
                            //             console.log(`Saving output to file: ${outputFile}, length: ${data.length} byte(s)`);
                            //             fs.writeFileSync(outputFile, data, { encoding: 'binary'});
                            //             res.render('summary', {selector: fileName, title: title, text: text });
                            //         } catch (e) {
                            //             console.log(e.message);
                            //         }
                            //     }
                            // });

                            // res.render('summary', {selector: fileName, title: title, text: text });

                            
                            
                          });    
                    }
                    else {
                        res.render('notfound');
                    }
                    
                
            });    
           
            
        }
        
       
           
     
       
            

      
      
          
      });

    // console.log(read_text);  
    // res.render('index', {selector: read_text});
});


app.listen(process.env.PORT || 3000, () => console.log('Example app listening on port 3000!'));