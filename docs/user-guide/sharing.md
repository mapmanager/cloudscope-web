# Sharing a view

One of the main goals of CloudScope Web is to make an analyzed dataset easy to discuss with collaborators and readers.

The CloudScope Web URL records the dataset and primary selection state. That means you can configure the dataset you want to discuss, copy the browser URL, and send that URL to somebody else.

## Recommended workflow

```text
Open the dataset
      ↓
Choose the image, channel, and ROI you want to discuss
      ↓
Copy the URL from the browser address bar
      ↓
Send the URL to a colleague
      ↓
Your colleague opens CloudScope Web at the same dataset and primary selection
```

You can paste the URL into email, Slack, a lab notebook, manuscript notes, an issue tracker, or any other place where a normal web link can be shared.

## What the URL restores

The current CloudScope Web URL stores the collection and primary image-selection state, including the selected image, channel, and ROI when applicable. Additional selection state used by supported datasets is also encoded by the application.

This makes the URL substantially more useful than linking only to the root OME-Zarr dataset: it tells CloudScope Web which part of the collection you were examining.

!!! note
    The current shared URL is intended to restore the dataset and primary selection state. Display details that are not encoded in the URL, such as every transient pan, zoom, or contrast adjustment, are not guaranteed to be reproduced.

## Sharing published datasets

The person receiving the link must be able to access the published dataset referenced by the URL. For public datasets this usually requires no additional steps: they open the link and CloudScope Web loads the data in their browser.

For scientific publishing, first publish the dataset at a stable location and then create the CloudScope Web view you want readers to open. See [Publishing a CloudScope dataset](../publishing/index.md).
