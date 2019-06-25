var express = require('express');
var app = express();

var server = require('http').Server(app)

var io = require('socket.io')(server)

var axios = require('axios');

//const hbjs = require('handbrake-js')

const fs = require('fs');

var port = process.env.PORT || 3000;

var users = names = {}

var proc = false;

var i = 0;

app.get("/", function(req,res){
    res.send('Welcome to my test app')
});

//app.listen(port);

server.listen(port)


console.log('Starting...');




io.on('connection', function(socket){

  
socket.on('test', function(){
  axios.get('http://192.168.137.130:8081/alfresco/api/-default-/public/alfresco/versions/1/nodes/1d7b3519-4900-49e8-bec8-17410dbcab3a',{
    headers:{ 
       Authorization: 'Basic YWRtaW46ZmQ1MW9mMTM=' 
    } 
  }).then(response =>{
    console.log(new Date(),response);
    
  }).catch(error =>{
    console.log(new Date(),error);
  })
})

  socket.on('invite', function(pers, ch, user){
    var person = { name:pers, channel:ch, host:user}
    //console.log('inviting ', ch);
    io.emit('updateChat.'+ ch);
    io.emit('invite', person);
  })

  socket.on('download',()=>{
    console.log('download');

    axios.get('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/63aa855a-c1ca-476f-b16a-3c8a78cc5d55/content',
               {
                   headers:{
                   Authorization: "Basic YWRtaW46cFQwQzR6ZEJyYXdX"
                   }
               }).then(response => {
                    var file = response.data;
                    fs.writeFileSync("downVideo.mp4", file);
                    var downloadedVideo = fs.readFileSync('downVideo.mp4')
                    socket.emit('play',downloadedVideo);
               })
    
  })

  socket.on('upload', function(data){
    console.log('starts');
    var newvideo = fs.writeFileSync("video.mp4", data.file);
    
    let handbrake = hbjs.spawn({ input: 'video.mp4', output: 'upVideo.mp4' })
    .on('error', err => {
      // invalid user input, no video found etc
    })
    .on('progress', progress => {
      console.log(
        'Percent complete: %s, ETA: %s',
        progress.percentComplete,
        progress.eta
      )
    }).on('complete', comlete=>{
      console.log(handbrake.output);
      let buff = fs.readFileSync('upVideo.mp4');
      console.log(buff);
      axios.put('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/63aa855a-c1ca-476f-b16a-3c8a78cc5d55/content',
                  buff,
                  {
                      headers:{
                      Authorization: "Basic YWRtaW46cFQwQzR6ZEJyYXdX"
                      }
                  }).then(response => {
                    console.log('done');
                  }).catch(err=>{console.log(err);
                  })
      
    }).on('output', output=>{
      // i+=1;
      // console.log(i);
    })

    
});


socket.on('chat', function(payload){
  if(proc == true){
      var wait = setInterval(() => {
          
          if(proc == false){
              postMessage(payload);
              clearInterval(wait);
          }
      }, 500);
  }else{
      postMessage(payload);
  }
})


    // user[0] = channel
    // user[1] = id 
    // user[2] = name
    // user[3] = session ticket
    socket.on('join', function(user){

       socket.userId = user[1];
       socket.userName = user[2];
       
       users[user[1]] = socket;
       names[user[1]] = {
           'name': user[2],
           'socketId': socket.id
       }
       
       updateNames();

       getChat(user);

       var msg = [user[0],'SYSTEM',user[2]+' joined channel',user[3], new Date().toLocaleString()];
       postMessage(msg);

       socket.on('updateChat', function(channel){
        io.emit('updateChat.'+ channel);
        
      })

      function updateNames(){
        io.emit('participants.' + user[0], names);
      }


      socket.on('leave', function(user){
        var msg = [user[0],'SYSTEM',user[2]+' left channel',user[3], new Date().toLocaleString()];
        //postMessage(msg);
            
            delete users[user[1]];
            delete names[user[1]];
  
            updateNames();
        })

    })

})




function postMessage(payload){
    if(proc == true){
        console.log('STOP');
        return; 
    }
    proc = true;
    
    let param = "cm:name:" + payload[0];
    
    // checking if there is already JSON file with that name
     axios.post('http://35.204.234.73/alfresco/api/-default-/public/search/versions/1/search',
         {
           "query":{
             "query":param
           }
         },
         {
           headers:{
             Authorization: 'Basic ' + payload[3]
           }
       }).then(response =>{
        
        if(response.data.list.entries.length<1){
            createChat(payload);
        }
        else{
            var id = response.data.list.entries[0].entry.id;
            updateChat(payload,id); 
        }
               
       }).catch(err => {
         console.log(err);
       })
    
}

function updateChat(payload,id){

    axios.get('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+id+'/content',
         
         {
            headers:{
                Authorization: 'Basic ' + payload[3]
            }
       }).then(response =>{
           let mesagges = response.data;
          
          
          let result = {name:payload[1], text:payload[2], time:new Date().toLocaleString()}
          if(mesagges.length>0){
            mesagges.push(result);
          }else{
              mesagges = [result];
          }
          
          axios.put('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+id+'/content?majorVersion=false',
              JSON.stringify(mesagges),
              {
                headers:{
                  Authorization: 'Basic ' + payload[3]
                }
            }).then(response => {
              io.emit('chat.' + payload[0], payload);
              proc = false;
              
              axios.get('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+id,
                {
                    headers:{
                        Authorization: 'Basic ' + payload[3]
                    },
                    include: ["properties"]
              }).then(response =>{
                  let arr = '';
                  if(response.data.entry.properties['cm:description'] != undefined){
                    let res = response.data.entry.properties['cm:description'].split(',');
                    for (let i = 0; i < res.length-1; i++) {
                        if(res[i] == payload[1])
                          return;
                      arr += res[i] + ',';
                    }
                  }
                  arr += payload[1] + ',';

                  axios.put('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+id,
                
                  {   "properties":
                    {
                    "cm:description":arr
                    }
                  },{
                  headers:{
                      Authorization: 'Basic ' + payload[3]
                  }
                  
                              
                  }).then(response =>{
                          
                  }).catch(err => {
                    console.log(err);
                  })
                  
              }).catch(err => {
                console.log(err);
              })

            }).catch(err => {
              console.log(err);
            })
          
       })


       
    
}

function createChat(payload){
    
    let obj = {}
        obj.name = payload[0];
        obj.nodeType = "cm:content";
        obj.properties = { "cm:description":payload[1]+',' }
          
        axios.post('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/45dbad81-e657-4020-9266-e09dc597c25f/children?autoRename=true',
          JSON.stringify(obj),
          {
            headers:{
                Authorization: 'Basic ' + payload[3]
            }
        }).then(response => {
          let result = [
            {name:payload[1], text:payload[2], time:new Date().toLocaleString()}
          ]
          
          let id = response.data.entry.id;
          
            axios.put('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+id+'/content?majorVersion=false',
              JSON.stringify(result),
              {
                headers:{
                  Authorization: 'Basic ' + payload[3]
                }
            }).then(response => {
                
              io.emit('chat.' + payload[0], payload);
              proc = false;
            }).catch(err => {
              console.log(err);
            })

            let obj = {}
            obj.name = payload[0] + "-invitations";
            obj.nodeType = "cm:content";
            let userName = payload[2].split(" ")
            let res = [{ name:userName[0], seen:true}];

            axios.post('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/45dbad81-e657-4020-9266-e09dc597c25f/children?autoRename=true',
                JSON.stringify(obj),
                {
                    headers:{
                    Authorization: 'Basic ' + payload[3]
                    }
                }).then(response => {
                    axios.put('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+response.data.entry.id+'/content?majorVersion=false',
                    JSON.stringify(res),
                    {
                        headers:{
                        Authorization: 'Basic ' + payload[3]
                        }
                    }).then(response => {
                        console.log('Initial participant');
                    })
                
                })

      })


}

function getChat(user){
    let param = "cm:name:" + user[0];

    axios.post('http://35.204.234.73/alfresco/api/-default-/public/search/versions/1/search',
         {
           "query":{
             "query":param
           }
         },
         {
           headers:{
             Authorization: 'Basic ' + user[3]
           }
       }).then(response =>{
           if(response.data.list.entries.length>0){
                var id = response.data.list.entries[0].entry.id;
                //console.log(id) 

                axios.get('http://35.204.234.73/alfresco/api/-default-/public/alfresco/versions/1/nodes/'+id+'/content',
                    {
                        headers:{
                            Authorization: 'Basic ' + user[3]
                        }
                }).then(response =>{
                    //console.log(response.data);
                    io.emit('prevchat.' + user[0], response.data);
                }).catch(err => {
                    console.log(err);
                })
           }
       }).catch(err => {
         console.log(err);
       })

}
