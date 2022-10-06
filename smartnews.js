// https://www.npmjs.com/package/xml
// https://sf-validator.smartnews.com/file
// https://www.rssboard.org/rss-draft-1
//  header( "Content-type: text/xml");

const xml = require('xml');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const luxon = require('luxon');
const { getEnabledCategories } = require('trace_events');

let options = {
    declaration: true,
    indent: "\t"
}

const show = info => {
    console.log(JSON.stringify(info, null, 4));
}

const writeCreateFileSync = (data, fn) => {
    const resolvedFn = path.resolve(fn);
    const resolvedDir = path.dirname(resolvedFn);
    console.log(resolvedDir, resolvedFn);

    fs.mkdirSync(resolvedDir, { recursive: true }, (error) => console.log(error));
    fs.writeFileSync(resolvedFn, data);
}

const getFeaturedMediaInfo = async id => {
    return new Promise ((resolve, reject) => {
        let request = {
            url: `https://pymnts.com/wp-json/wp/v2/media/${id}`,
            method: 'get'
        }
        console.log(`\t${request.url}`);
        axios(request)
        .then(response => {
            resolve(response.data);
        })
        .catch(error => {
            console.error('category error', error);
            resolve(false);
        })
    })
}

const getAuthor = async num => {
    return new Promise ((resolve, reject) => {
        let request = {
            url: `https://pymnts.com/wp-json/wp/v2/users/${num}`,
            method: 'get'
        }
        console.log(`\t${request.url}`);
        axios(request)
        .then(response => {
            resolve(response.data.name);
        })
        .catch(error => {
            console.error('category error', error.code);
            resolve(false);
        })
    })
}

const getCategory = async num => {
    return new Promise ((resolve, reject) => {
        let request = {
            url: `https://pymnts.com/wp-json/wp/v2/categories/${num}`,
            method: 'get'
        }
        console.log(`\t${request.url}`);
        axios(request)
        .then(response => {
            resolve(response.data.name);
        })
        .catch(error => {
            console.error('category error', request, error.code);
            resolve(false);
        })
    })
}

const getTag = async num => {
    return new Promise ((resolve, reject) => {
        let request = {
            url: `https://pymnts.com/wp-json/wp/v2/tags/${num}`,
            method: 'get'
        }
        console.log(`\t${request.url}`);
        axios(request)
        .then(response => {
            resolve(response.data.name);
        })
        .catch(error => {
            console.error('tags error', request, error.code);
            resolve(false);
        })
    })
}

const getCategories = async post => {
    let  i;
    let categories = new Set();

    if (post.categories) {
        for (i = 0; i < post.categories.length; ++i) {
            let category = await getCategory(post.categories[i]);
            categories.add(category.toLowerCase());
        }
    }

    if (post.tags) {
        for (i = 0; i < post.tags.length; ++i) {
            let tag = await getTag(post.tags[i]);
            categories.add(tag.toLowerCase());
        }
    }

    let catArray = Array.from(categories);
    console.log(catArray);
    return catArray;

}

const getItemObject = (title, link, pubDate, description) => {
    let f = {};
    f.item = [];
    f.item.push({title});
    f.item.push({link});
    f.item.push({pubDate});
    f.item.push({
        description: {
            _cdata: description
        }
    })
    let contentEncode = {};
    contentEncode['content:encoded'] = {_cdata: description};
    f.item.push(contentEncode);
    return f;
}

const addPostsToChannel = async (posts, channel) => {
    for (let i = 0; i < posts.length; ++i) {
        let post = posts[i];
        let title = post.title.rendered;
        let link = post.link;
        let excerpt = post.excerpt.rendered;
        let content = post.content.rendered;
        let isoDate = post.date_gmt;
        let pubDate = luxon.DateTime.fromISO(isoDate).toRFC2822();
        let mediaId = post.featured_media;
        let authorId = post.author;
        let categories = await getCategories(post);
        
        // get media to prepend to description and content:encoded
        let prepend = '';

        let mediaInfo;
        let mediaUrl = '';
        let mediaBigUrl = '';
        let mediaMedium = '';
        let mediaType = '';
        let mediaDuration = 10;

        switch(post.format) {
            case 'video':
                console.log(`HANDLE VIDEO HERE: ${post.id}`);

                //break;
            default:
                mediaInfo = await getFeaturedMediaInfo(mediaId);
                mediaUrl = mediaInfo.media_details.sizes['mvp-medium-thumb'].source_url;
                mediaBigUrl = mediaInfo.media_details.sizes['post-thumbnail'].source_url;
                mediaMedium = mediaInfo.media_type;
                mediaType = mediaInfo.mime_type;
                mediaDuration = 10;

                prepend = `<a href="${link}"><img src=${mediaUrl} width="450" height="270"/></a>`
                
                
                console.log('prepend', prepend);
        }

        
        // get description (d)
        let description = {}
        description.description = {_cdata : prepend + excerpt};

        // get content:encoded
        let contentEncoded = {};
        contentEncoded['content:encoded'] = {_cdata: prepend + content};

        // get author/creator info
        let author = await getAuthor(authorId);
        let dcCreator = {};
        author = author.trim();
        dcCreator['dc:creator'] = {_cdata: author}
    
        // create item object
        let o = {};
        o.item = [];
        let item = o.item;

        // push item content

        // TODO: media:content
        let mediaContent = {};
        mediaContent['media:content'] = {
            _attr : {
                medium: mediaMedium,
                type: mediaType,
                url: mediaUrl,
                duration: mediaDuration
            }
        }
        item.push(mediaContent);

        let mediaThumbnail = {};
        mediaThumbnail['media:thumbnail'] = {
            _attr: {
                url: mediaBigUrl
            }
        }
        item.push(mediaThumbnail);
       
        item.push({title});
        item.push({link});
        item.push({guid : link});
        item.push({author});
        item.push(dcCreator);
        item.push({pubDate})
        item.push(description);
        item.push(contentEncoded);

        // add categories

        for (let j = 0; j < categories.length; ++j) {
            let category = {};
            category.category = {_cdata: categories[j]};
            item.push(category);
        }
        let analyticsPage = `SmartNews: ${title}`;

        let analyticsScript = `<script>
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
      
        ga('create', 'UA-11167465-1', 'pymnts.com');
        ga('require', 'displayfeatures');
        ga('set', 'referrer', 'http://www.smartnews.com/');
        ga('send', 'pageview', {
            title: '${analyticsPage}'
        });
          </script>`
        let snfAnalytics = {};
        snfAnalytics['snf:analytics'] = {_cdata: analyticsScript};
        item.push(snfAnalytics);
        channel.push(o);
    }
}

let lastPostId = 0;
let lastPostModified = '';

const updateSmartNewsFeed = async (numPosts) => {
    let feed = { rss: []};
    
    // configure <rss>
    let rssFeed = feed.rss;
    
    rssFeed.push({
        _attr: {
            version: '2.0'
        },
    });
    const rssFeedAttr = rssFeed[0]._attr;
    rssFeedAttr['xmlns:content'] = "http://purl.org/rss/1.0/modules/content/";
    rssFeedAttr['xmlns:wfw'] = "http://wellformedweb.org/CommentAPI/";
    rssFeedAttr['xmlns:atom'] = "http://www.w3.org/2005/Atom";
    rssFeedAttr['xmlns:sy'] = "http://purl.org/rss/1.0/modules/syndication/";
    rssFeedAttr['xmlns:slash'] = "http://purl.org/rss/1.0/modules/slash/";
    rssFeedAttr['xmlns:dc'] = "http://purl.org/dc/elements/1.1/";
    rssFeedAttr['xmlns:media'] = "http://search.yahoo.com/mrss/";
    rssFeedAttr['xmlns:snf'] = "http://www.smartnews.be/snf";
    
    // configure <channel>
    rssFeed.push({ channel: [] })
    let rssChannel = rssFeed[1].channel;
    
    rssChannel.push( { title: "PYMNTS.com" });
    let channelAtom = {};
    channelAtom['atom:link'] = {
        _attr: {
            href: "https://www.pymnts.com/feed/",
            rel: "self",
            type: "application/rss+xml"
        }
    }
    rssChannel.push(channelAtom);
    rssChannel.push({ link: "https://www.pymnts.com" });
    rssChannel.push({description: "What's next in payments and commerce"});
        let curDate = new Date();
    rssChannel.push({lastBuildDate: luxon.DateTime.fromJSDate(curDate).toRFC2822()});
    rssChannel.push({language: "en-US"});
        let syUpdatePeriod = {};
        syUpdatePeriod['sy:updatePeriod'] = 'hourly';
    rssChannel.push(syUpdatePeriod);
        let syUpdateFrequency = {};
        syUpdateFrequency['sy:updateFrequency'] = 1;
    rssChannel.push(syUpdateFrequency);
    rssChannel.push({generator: 'Pymnts RSS Generator'})
        let channelImage = [];
        channelImage.push({url: "https://www.pymnts.com/wp-content/uploads/2019/04/cropped-512-1-32x32.jpg"});
        channelImage.push({title: 'PYMNTS.com'});
        channelImage.push({link: 'https://www.pymnts.com'});
        channelImage.push({width: 32});
        channelImage.push({height: 32});
    rssChannel.push({image: channelImage});
        let snfLogo = {};
        snfLogo['snf:logo'] = [{url: 'https://services.pymnts.com/smartnews/PYMNTS-700x100-80h.png'}];

    rssChannel.push(snfLogo);

    // get latest posts and add to rss channel as item objects

    let request = {
        url: `https://pymnts.com/wp-json/wp/v2/posts/?type=posts&per_page=${numPosts}`,
        method: 'get',
        timeout: 25000
    }
    console.log(request.url);

    let response;

    try {
        response = await axios(request);
        await addPostsToChannel(response.data, rssChannel);
    } catch (error) {
        console.log(error);
    }
    
    // let description = '<a href="https://www.pymnts.com/news/regulation/2022/europe-stamps-digital-services-act-with-final-approval/" title="Europe Stamps Digital Services Act With Final Approval" rel="nofollow"><img width="450" height="270" src="https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-450x270.jpg" class="webfeedsFeaturedVisual wp-post-image" alt="Digital Services Act, DSA, legislation, EU" loading="lazy" style="display: block; margin: auto; margin-bottom: 5px;max-width: 100%;" link_thumbnail="1" srcset="https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-450x270.jpg 450w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-258x155.jpg 258w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-457x274.jpg 457w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-768x461.jpg 768w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-1000x600.jpg 1000w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-300x180.jpg 300w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec-150x90.jpg 150w, https://securecdn.pymnts.com/wp-content/uploads/2022/10/digital-services-act-ec.jpg 1200w" sizes="(max-width: 450px) 100vw, 450px" /></a>The European Council has officially approved legislation that aims to ensure a safer and more transparent online environment with greater accountability and protection. The Digital Services Act (DSA), packaged with the Digital Marketing Act (DMA), requires transparency from technology platforms as well as accountability in their role as disseminators of content, according to a statement [&#8230;]';
    
    // let itemObject = getItemObject(
    //     'Europe YOYO Stamps Digital Services Act With Final Approval',
    //     "https://www.pymnts.com/news/regulation/2022/europe-stamps-digital-services-act-with-final-approval/",
    //     'Tue, 04 Oct 2022 16:49:32 +0000',
    //     description
    //     )
    
    // rssChannel.push(itemObject);
    //console.log(xml(feed, options));
    

    writeCreateFileSync(xml(feed, options), '/var/www/services.pymnts.com/smartnews/rss.xml');
}


  const handleNewPosts = async data => {
    console.log('got new post(s): update feed');
  
  }

const getLastPosts = async (numPosts) => {
    let request = {
        url: `https://pymnts.com/wp-json/wp/v2/posts/?type=posts&per_page=${numPosts}`,
        method: 'get',
        timeout: 25000
    }
    console.log(request.url);
    //request.url="https://pymnts.com";

    let response;

    try {
        response = await axios(request);
        console.log(response);
        // const { id, modified_gmt, link } = response.data[0];
        // if (id !== lastPostId || modified_gmt !== lastPostModified) {
        //     lastPostId = id;
        //     lastPostModified = modified_gmt;
        //     handleNewPosts(response.data);
        // }
        
    }    
    catch(err) {
        console.error(err);
        return;
    }
}

// getLastPosts(10);

// setInterval(() => {
//     getLastPosts(10);
// }, 120000)

setInterval(() => {
    updateSmartNewsFeed(10);
}, 5 * 60 * 1000);
