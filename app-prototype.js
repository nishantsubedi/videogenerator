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
var stringSimilarity = require('string-similarity');
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
app.use('/output',express.static(path.join(__dirname, 'output')));

app.get('/', (req, res) => {
    res.render('index');
});
app.get('/meetcreators', (req, res) => {
    res.render('meetcreators');
});
app.post('/summarize', (req, res) => {
   
    var title = req.body.title;
   if(title.length<2){
        return res.render('notfound', { error: 'Query too short'});
   }
   console.log('title: ', title);
    google(title, function (err, response){
        if (err) {
           console.error(err);
           return res.render('notfound', {error: 'SEARCH FAILED OR NETWORK ERROR'});
        }
        if (response.links.length < 1) {
          
            return res.render('notfound', {error: 'NO RESULT FOUND'});
         }
            // console.log(response.links);
            var url = null;
            var similarity = 0.0;
            for(var j=0; j<response.links.length; j++){
                if(response.links[j].href != null && response.links[j].description != null){
                    if(response.links[j].href.includes('wiki') && j<7){
                        url = response.links[j].href;
                        break;
                    }
                    
                   
                    var smilarity_link = 2 * stringSimilarity.compareTwoStrings(title,response.links[j].href);
                    var similarity_data = stringSimilarity.compareTwoStrings(title,response.links[j].description);
                    
                    var mean = (smilarity_link * similarity_data)/(j+1);
                    console.log(response.links[j].href);
                    console.log('similarity of description', similarity_data);
                    console.log('similarity of link', smilarity_link);
                    console.log('mean', mean);
                    console.log('\n');
                    if( mean > similarity){
                        similarity = mean;
                        url = response.links[j].href;
                    }
                        
                       
                } 
            }
            if(url == null){
                console.log('no relevent url found');
                return res.render('notfound', {error: 'NO RELEVANT DOCUMENT FOUND'});
            }
            console.log('selected url with similirity ', similarity);
            console.log(url);
            var selector = 'p';
            var read_text =  '';
       
            scrapy.scrape(url, selector, function(err, data) {
                    if (err){
                        console.error(err);
                        return res.render('notfound', {error: 'CANNOT FETCH DATA'});
                    }  
                
                    if( data == null){
                        console.log('scrapy returned null data');
                        return res.render('notfound',{error: 'NO DATA RETRIEVED FROM WEB PAGE'});
                       
                    }
                        for(var i = 0 ; i < data.length ; i++){
                            if(read_text.length < 20000){
                                read_text = read_text + ' ' + data[i];
                            }
                                
                        }
                        // read_text=data.toString();
                        read_text = read_text.replace(/\[(.+?)\]/g, "");
                        
                        console.log('data cleaned');
                        console.log('summarizing data of length', read_text.length);
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
                                console.error('summarization request failed:', err);
                                return res.render('notfound',{error: 'FAILED TO SUMMARIZE DATA'});
                            }
                            var response = JSON.parse(body);
                            // console.log(response);
                            
                            const text = process.argv[2] || response.output;
                            if( text == null){
                                console.log('summarization failed');
                                return res.render('notfound',{error: 'SUMMARIZATION RETURNED EMPTY TEXT'});
                            }
                            text.replace('\n', '');
                            console.log('summarization completed, summarized to length ', text.length);
                            // console.log(text);

                            var fileName = title + '-' + Date.now() +'.mp3';
                            const outputFile = process.argv[3] || path.join(__dirname,'/output/') + fileName;
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
                                    // console.log(content);
                                    if(error){
                                        console.error('synthesize failed:', error);
                                        return res.render('notfound',{error: 'FAILED TO SYNTHESIZE TEXT'});
                                    }
                                    fs.writeFileSync(outputFile,  content);
                                    console.log('Audio File saved as ', fileName);
                                    return res.render('summary', {selector: fileName, title: title, text: text , content: content});

                                }
                            });
                           

                            
                            
                          });    
                   
                
            });    
           
            
        
        
       
           
     
       
            

      
      
          
      });

    // console.log(read_text);  
    // res.render('index', {selector: read_text});
});


app.listen(process.env.PORT || 3000, () => console.log('Example app listening on port 3000!'));